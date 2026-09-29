import type { PushRecord, Result } from './household'
import { localDate, noteEligible, parseNotes, pickNote } from './love'
import { DATA_RE, ID_RE, MAX_BODY_BYTES, MAX_RECORD_CHARS, MAX_RECORDS_PER_PUSH, PULL_DEFAULT, REGISTER_PER_MINUTE, SECRET_RE } from './limits'

export { Household } from './household'

// Routes (all JSON). Every household route needs `Authorization: Bearer <secret>`;
// all but register/join/close also need `X-Member: <member id>`.
//   POST   /v1/households/:hid           register a new household (caller is member 1)
//   POST   /v1/households/:hid/join      join as member 2
//   GET    /v1/households/:hid           { members, version }
//   POST   /v1/households/:hid/push      { records: [{ rid, ts, tomb, data }] }
//   GET    /v1/households/:hid/changes?since=N&limit=M
//   DELETE /v1/households/:hid           unlink: delete everything for this household
//   GET    /v1/households/:hid/note      today's note { date, text } for the one household
//                                        allowed (see love.ts); 404 no_note for everyone else
//
// Nothing here logs request bodies, secrets or ciphertext.

const ROUTE = /^\/v1\/households\/([A-Za-z0-9_-]{22})(?:\/(join|push|changes|note))?$/

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !allowedOrigins(env).includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Member',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors },
  })
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Read the body with a hard size cap, whatever Content-Length claims. */
async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get('Content-Length') ?? '0')
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'body_too_large')
  if (!req.body) throw new HttpError(400, 'body_required')
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new HttpError(413, 'body_too_large')
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    all.set(c, off)
    off += c.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(all))
  } catch {
    throw new HttpError(400, 'bad_json')
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

function parsePush(body: unknown): PushRecord[] {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { records?: unknown }).records)) throw new HttpError(400, 'records_required')
  const list = (body as { records: unknown[] }).records
  if (list.length === 0) throw new HttpError(400, 'records_required')
  if (list.length > MAX_RECORDS_PER_PUSH) throw new HttpError(413, 'too_many_records')
  const seen = new Set<string>()
  return list.map((r) => {
    if (typeof r !== 'object' || r === null) throw new HttpError(400, 'bad_record')
    const { rid, ts, tomb, data } = r as Record<string, unknown>
    if (typeof rid !== 'string' || !ID_RE.test(rid)) throw new HttpError(400, 'bad_record_id')
    if (seen.has(rid)) throw new HttpError(400, 'duplicate_record_id')
    seen.add(rid)
    if (typeof ts !== 'number' || !Number.isSafeInteger(ts) || ts <= 0) throw new HttpError(400, 'bad_timestamp')
    if (typeof data !== 'string' || !DATA_RE.test(data) || data.length < 40) throw new HttpError(400, 'bad_data')
    if (data.length > MAX_RECORD_CHARS) throw new HttpError(413, 'record_too_large')
    return { rid, ts, tomb: tomb === true, data }
  })
}

// Best-effort limit on creating households, per client IP, per isolate.
const registrations = new Map<string, number[]>()
function registerAllowed(ip: string): boolean {
  const now = Date.now()
  const recent = (registrations.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= REGISTER_PER_MINUTE) {
    registrations.set(ip, recent)
    return false
  }
  recent.push(now)
  registrations.set(ip, recent)
  if (registrations.size > 10_000) registrations.clear()
  return true
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin')
    const cors = corsHeaders(origin, env)
    // A browser origin that is not on the list gets nothing.
    if (origin && !cors['Access-Control-Allow-Origin']) return json({ error: 'origin_not_allowed' }, 403, {})
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(req.url)
    if (url.pathname === '/v1/health' && req.method === 'GET') return json({ ok: true }, 200, cors)
    const m = ROUTE.exec(url.pathname)
    if (!m) return json({ error: 'not_found' }, 404, cors)
    const hid = m[1] as string
    const action = m[2]

    try {
      const auth = req.headers.get('Authorization') ?? ''
      const secret = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (!SECRET_RE.test(secret)) throw new HttpError(401, 'bad_secret')
      const secretHash = await crypto.subtle.digest('SHA-256', b64urlToBytes(secret))
      const member = req.headers.get('X-Member') ?? ''
      const needMember = () => {
        if (!ID_RE.test(member)) throw new HttpError(400, 'bad_member_id')
        return member
      }
      const stub = env.HOUSEHOLD.getByName(hid)
      let r: Result<unknown>

      if (!action && req.method === 'POST') {
        if (!registerAllowed(req.headers.get('CF-Connecting-IP') ?? 'local')) throw new HttpError(429, 'rate_limited')
        r = await stub.register(secretHash, needMember())
        if (r.ok) return json(r.value, 201, cors)
      } else if (!action && req.method === 'GET') {
        r = await stub.info(secretHash, needMember())
      } else if (!action && req.method === 'DELETE') {
        r = await stub.close(secretHash)
      } else if (action === 'join' && req.method === 'POST') {
        r = await stub.join(secretHash, needMember())
      } else if (action === 'push' && req.method === 'POST') {
        const records = parsePush(await readJson(req))
        r = await stub.push(secretHash, needMember(), records)
      } else if (action === 'changes' && req.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? '0')
        const limit = Number(url.searchParams.get('limit') ?? String(PULL_DEFAULT))
        if (!Number.isSafeInteger(since) || since < 0 || !Number.isSafeInteger(limit) || limit < 1) throw new HttpError(400, 'bad_cursor')
        r = await stub.changes(secretHash, needMember(), since, limit)
      } else if (action === 'note' && req.method === 'GET') {
        const about = await stub.about(secretHash, needMember())
        if (!about.ok) return json({ error: about.error }, about.status, cors)
        const notes = parseNotes(env.LOVE_NOTES)
        if (!notes.length || !noteEligible(about.value.members, about.value.createdAt, env.LOVE_BEFORE)) return json({ error: 'no_note' }, 404, cors)
        const tz = req.cf?.timezone
        const date = localDate(new Date(), typeof tz === 'string' ? tz : undefined)
        return json({ date, text: pickNote(notes, date) }, 200, cors)
      } else {
        return json({ error: 'method_not_allowed' }, 405, cors)
      }
      return r.ok ? json(r.value ?? { ok: true }, 200, cors) : json({ error: r.error }, r.status, cors)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code }, e.status, cors)
      // No request details in logs, only that something failed.
      console.error('sync: internal error')
      return json({ error: 'internal' }, 500, cors)
    }
  },
} satisfies ExportedHandler<Env>
