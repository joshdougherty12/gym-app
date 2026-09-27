import { DurableObject } from 'cloudflare:workers'
import {
  MAX_BYTES_PER_HOUSEHOLD,
  MAX_MEMBERS,
  MAX_RECORDS_PER_HOUSEHOLD,
  PULL_MAX,
  RATE_CAPACITY,
  RATE_REFILL_PER_SEC,
  TOMBSTONE_TTL_MS,
} from './limits'

/** One record as pushed by a client. `data` is base64url(iv || AES-GCM ciphertext); the server never sees plaintext. */
export interface PushRecord {
  rid: string
  ts: number
  tomb: boolean
  data: string
}

export interface PulledRecord {
  rid: string
  v: number
  ts: number
  data: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string }

const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error })

/**
 * One Durable Object per household (SQLite-backed). It serializes every write
 * for the household, so the version counter is strictly increasing with no
 * cross-request races. It stores a hash of the household secret, the member
 * ids (random, not personal) and opaque ciphertext rows.
 */
export class Household extends DurableObject<Env> {
  private sql: SqlStorage
  private tokens = RATE_CAPACITY
  private refilledAt = Date.now()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, joined_at INTEGER NOT NULL)`)
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS records (rid TEXT PRIMARY KEY, v INTEGER NOT NULL, ts INTEGER NOT NULL, tomb INTEGER NOT NULL, size INTEGER NOT NULL, data TEXT NOT NULL, stored_at INTEGER NOT NULL)`,
    )
    this.sql.exec(`CREATE INDEX IF NOT EXISTS records_v ON records (v)`)
  }

  private meta(k: string): string | undefined {
    const row = this.sql.exec<{ v: string }>(`SELECT v FROM meta WHERE k = ?`, k).toArray()[0]
    return row?.v
  }

  private setMeta(k: string, v: string | number): void {
    this.sql.exec(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, String(v))
  }

  private version(): number {
    return Number(this.meta('version') ?? '0')
  }

  /** Token bucket shared by every request to this household. */
  private allow(): boolean {
    const now = Date.now()
    this.tokens = Math.min(RATE_CAPACITY, this.tokens + ((now - this.refilledAt) / 1000) * RATE_REFILL_PER_SEC)
    this.refilledAt = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }

  /** Check the secret's hash (constant time) and, when given, that the member belongs here. */
  private async auth(secretHash: ArrayBuffer, memberId?: string): Promise<Result<null>> {
    if (!this.allow()) return fail(429, 'rate_limited')
    if (this.meta('closed') === '1') return fail(410, 'household_closed')
    const stored = this.meta('auth_hash')
    if (!stored) return fail(404, 'no_household')
    const a = new Uint8Array(secretHash)
    const b = hexToBytes(stored)
    if (!timingSafeEqual(a, b)) return fail(401, 'bad_secret')
    if (memberId !== undefined && !this.isMember(memberId)) return fail(403, 'not_a_member')
    return { ok: true, value: null }
  }

  private isMember(id: string): boolean {
    return this.sql.exec(`SELECT 1 FROM members WHERE id = ?`, id).toArray().length > 0
  }

  private memberCount(): number {
    return Number(this.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM members`).one().n)
  }

  async register(secretHash: ArrayBuffer, memberId: string): Promise<Result<{ members: number }>> {
    if (!this.allow()) return fail(429, 'rate_limited')
    if (this.meta('closed') === '1') return fail(410, 'household_closed')
    if (this.meta('auth_hash')) return fail(409, 'household_exists')
    this.ctx.storage.transactionSync(() => {
      this.setMeta('auth_hash', bytesToHex(new Uint8Array(secretHash)))
      this.setMeta('created_at', Date.now())
      this.setMeta('version', 0)
      this.setMeta('purged_through', 0)
      this.sql.exec(`INSERT INTO members (id, joined_at) VALUES (?, ?)`, memberId, Date.now())
    })
    return { ok: true, value: { members: 1 } }
  }

  async join(secretHash: ArrayBuffer, memberId: string): Promise<Result<{ members: number }>> {
    const a = await this.auth(secretHash)
    if (!a.ok) return a
    if (!this.isMember(memberId)) {
      if (this.memberCount() >= MAX_MEMBERS) return fail(403, 'household_full')
      this.sql.exec(`INSERT INTO members (id, joined_at) VALUES (?, ?)`, memberId, Date.now())
    }
    return { ok: true, value: { members: this.memberCount() } }
  }

  async info(secretHash: ArrayBuffer, memberId: string): Promise<Result<{ members: number; version: number }>> {
    const a = await this.auth(secretHash, memberId)
    if (!a.ok) return a
    return { ok: true, value: { members: this.memberCount(), version: this.version() } }
  }

  async push(secretHash: ArrayBuffer, memberId: string, records: PushRecord[]): Promise<Result<{ accepted: string[]; stale: string[]; version: number }>> {
    const a = await this.auth(secretHash, memberId)
    if (!a.ok) return a
    this.purgeTombstones()
    const accepted: string[] = []
    const stale: string[] = []
    try {
    this.ctx.storage.transactionSync(() => {
      let version = this.version()
      const totals = this.sql.exec<{ n: number; bytes: number | null }>(`SELECT COUNT(*) AS n, SUM(size) AS bytes FROM records`).one()
      let count = Number(totals.n)
      let bytes = Number(totals.bytes ?? 0)
      const now = Date.now()
      for (const r of records) {
        const cur = this.sql.exec<{ ts: number; size: number }>(`SELECT ts, size FROM records WHERE rid = ?`, r.rid).toArray()[0]
        // Last writer wins by the client's timestamp: an older write never replaces a newer one.
        if (cur && cur.ts >= r.ts) {
          stale.push(r.rid)
          continue
        }
        const nextCount = count + (cur ? 0 : 1)
        const nextBytes = bytes - (cur?.size ?? 0) + r.data.length
        // Over a cap: throwing rolls back the whole push.
        if (nextCount > MAX_RECORDS_PER_HOUSEHOLD || nextBytes > MAX_BYTES_PER_HOUSEHOLD) throw new CapExceeded()
        version += 1
        this.sql.exec(
          `INSERT INTO records (rid, v, ts, tomb, size, data, stored_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(rid) DO UPDATE SET v = excluded.v, ts = excluded.ts, tomb = excluded.tomb, size = excluded.size, data = excluded.data, stored_at = excluded.stored_at`,
          r.rid,
          version,
          r.ts,
          r.tomb ? 1 : 0,
          r.data.length,
          r.data,
          now,
        )
        count = nextCount
        bytes = nextBytes
        accepted.push(r.rid)
      }
      this.setMeta('version', version)
    })
    } catch (e) {
      if (e instanceof CapExceeded) return fail(413, 'household_full_of_data')
      throw e
    }
    return { ok: true, value: { accepted, stale, version: this.version() } }
  }

  async changes(secretHash: ArrayBuffer, memberId: string, since: number, limit: number): Promise<Result<{ records: PulledRecord[]; cursor: number; more: boolean; reset: boolean }>> {
    const a = await this.auth(secretHash, memberId)
    if (!a.ok) return a
    // A client that missed purged deletions must start over from the beginning.
    const purged = Number(this.meta('purged_through') ?? '0')
    const reset = since > 0 && since < purged
    const from = reset ? 0 : since
    const n = Math.min(Math.max(1, limit), PULL_MAX)
    const rows = this.sql.exec<{ rid: string; v: number; ts: number; data: string }>(`SELECT rid, v, ts, data FROM records WHERE v > ? ORDER BY v LIMIT ?`, from, n + 1).toArray()
    const more = rows.length > n
    const page = rows.slice(0, n).map((r) => ({ rid: r.rid, v: Number(r.v), ts: Number(r.ts), data: r.data }))
    const last = page[page.length - 1]
    return { ok: true, value: { records: page, cursor: last ? last.v : Math.max(from, this.version()), more, reset } }
  }

  /** Unlink: delete every record and member. The household id is kept only as "closed" so the partner learns it ended. */
  async close(secretHash: ArrayBuffer): Promise<Result<null>> {
    const a = await this.auth(secretHash)
    if (!a.ok) return a
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(`DELETE FROM records`)
      this.sql.exec(`DELETE FROM members`)
      this.sql.exec(`DELETE FROM meta`)
      this.setMeta('closed', '1')
    })
    return { ok: true, value: null }
  }

  private purgeTombstones(): void {
    const cutoff = Date.now() - TOMBSTONE_TTL_MS
    const top = this.sql.exec<{ v: number | null }>(`SELECT MAX(v) AS v FROM records WHERE tomb = 1 AND stored_at < ?`, cutoff).one().v
    if (top === null || top === undefined) return
    this.sql.exec(`DELETE FROM records WHERE tomb = 1 AND stored_at < ?`, cutoff)
    const purged = Number(this.meta('purged_through') ?? '0')
    if (Number(top) > purged) this.setMeta('purged_through', Number(top))
  }
}

class CapExceeded extends Error {}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison (no early exit on the first differing byte). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}
