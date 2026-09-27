import { env, exports } from 'cloudflare:workers'
import { runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { MAX_BODY_BYTES, MAX_RECORDS_PER_PUSH } from '../src/limits'

const worker = exports.default as unknown as { fetch: (req: Request) => Promise<Response> }
const BASE = 'https://sync.test'

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const rand = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)))
const newId = () => rand(16)
const newSecret = () => rand(32)
const blob = (n = 60) => rand(n)

function call(method: string, path: string, opts: { secret?: string; member?: string; body?: unknown; origin?: string; raw?: string; ip?: string } = {}) {
  // Each test client gets its own address unless one is given (registration is limited per IP).
  const headers: Record<string, string> = { 'CF-Connecting-IP': opts.ip ?? newId() }
  if (opts.secret) headers.Authorization = `Bearer ${opts.secret}`
  if (opts.member) headers['X-Member'] = opts.member
  if (opts.origin) headers.Origin = opts.origin
  let body: string | undefined
  if (opts.raw !== undefined) body = opts.raw
  else if (opts.body !== undefined) body = JSON.stringify(opts.body)
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return worker.fetch(new Request(`${BASE}${path}`, { method, headers, body }))
}

async function household() {
  const hid = newId()
  const secret = newSecret()
  const a = newId()
  const res = await call('POST', `/v1/households/${hid}`, { secret, member: a })
  expect(res.status).toBe(201)
  return { hid, secret, a }
}

describe('households', () => {
  it('registers once, then refuses the same id', async () => {
    const { hid, secret, a } = await household()
    const again = await call('POST', `/v1/households/${hid}`, { secret, member: a })
    expect(again.status).toBe(409)
    const info = await call('GET', `/v1/households/${hid}`, { secret, member: a })
    expect(info.status).toBe(200)
    expect(await info.json()).toEqual({ members: 1, version: 0 })
  })

  it('rejects a wrong or malformed secret, and a stranger member id', async () => {
    const { hid, a } = await household()
    expect((await call('GET', `/v1/households/${hid}`, { secret: newSecret(), member: a })).status).toBe(401)
    expect((await call('GET', `/v1/households/${hid}`, { secret: 'short', member: a })).status).toBe(401)
    expect((await call('GET', `/v1/households/${hid}`, { member: a })).status).toBe(401)
    const { secret } = await household().then(async (h) => ({ secret: h.secret, hid: h.hid }))
    // The right format but another household's secret.
    expect((await call('GET', `/v1/households/${hid}`, { secret, member: a })).status).toBe(401)
  })

  it('404s an unknown household and validates ids', async () => {
    expect((await call('GET', `/v1/households/${newId()}`, { secret: newSecret(), member: newId() })).status).toBe(404)
    expect((await call('GET', `/v1/households/not-an-id`, { secret: newSecret(), member: newId() })).status).toBe(404)
    const { hid, secret } = await household()
    expect((await call('GET', `/v1/households/${hid}`, { secret, member: 'x' })).status).toBe(400)
  })

  it('takes two members and no more; joining again is harmless', async () => {
    const { hid, secret, a } = await household()
    const b = newId()
    const j = await call('POST', `/v1/households/${hid}/join`, { secret, member: b })
    expect(j.status).toBe(200)
    expect(await j.json()).toEqual({ members: 2 })
    expect((await call('POST', `/v1/households/${hid}/join`, { secret, member: b })).status).toBe(200)
    expect((await call('POST', `/v1/households/${hid}/join`, { secret, member: a })).status).toBe(200)
    expect((await call('POST', `/v1/households/${hid}/join`, { secret, member: newId() })).status).toBe(403)
  })

  it('unlink deletes everything; afterwards both sides get 410', async () => {
    const { hid, secret, a } = await household()
    const b = newId()
    await call('POST', `/v1/households/${hid}/join`, { secret, member: b })
    await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ rid: newId(), ts: 1, data: blob() }] } })
    expect((await call('DELETE', `/v1/households/${hid}`, { secret })).status).toBe(200)
    expect((await call('GET', `/v1/households/${hid}/changes?since=0`, { secret, member: b })).status).toBe(410)
    expect((await call('POST', `/v1/households/${hid}`, { secret, member: a })).status).toBe(410)
  })
})

describe('push and pull', () => {
  it('pulls changes after a cursor, in order, in pages', async () => {
    const { hid, secret, a } = await household()
    const b = newId()
    await call('POST', `/v1/households/${hid}/join`, { secret, member: b })
    const rids = [newId(), newId(), newId()]
    const push = await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: rids.map((rid, i) => ({ rid, ts: 100 + i, data: blob() })) } })
    expect(push.status).toBe(200)
    expect(await push.json()).toMatchObject({ accepted: rids, stale: [], version: 3 })

    const p1 = (await (await call('GET', `/v1/households/${hid}/changes?since=0&limit=2`, { secret, member: b })).json()) as { records: { rid: string; v: number }[]; cursor: number; more: boolean }
    expect(p1.records.map((r) => r.rid)).toEqual(rids.slice(0, 2))
    expect(p1.more).toBe(true)
    const p2 = (await (await call('GET', `/v1/households/${hid}/changes?since=${p1.cursor}&limit=2`, { secret, member: b })).json()) as { records: { rid: string }[]; cursor: number; more: boolean }
    expect(p2.records.map((r) => r.rid)).toEqual(rids.slice(2))
    expect(p2.more).toBe(false)
    const p3 = (await (await call('GET', `/v1/households/${hid}/changes?since=${p2.cursor}`, { secret, member: b })).json()) as { records: unknown[]; cursor: number }
    expect(p3.records).toEqual([])
    expect(p3.cursor).toBe(3)
  })

  it('keeps the newest write per record (last writer wins by timestamp)', async () => {
    const { hid, secret, a } = await household()
    const rid = newId()
    const newer = blob()
    await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ rid, ts: 200, data: newer }] } })
    const old = await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ rid, ts: 150, data: blob() }] } })
    expect(await old.json()).toMatchObject({ accepted: [], stale: [rid] })
    const upd = await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ rid, ts: 300, data: newer, tomb: true }] } })
    expect(await upd.json()).toMatchObject({ accepted: [rid], version: 2 })
    const all = (await (await call('GET', `/v1/households/${hid}/changes?since=0`, { secret, member: a })).json()) as { records: { rid: string; v: number; ts: number }[] }
    expect(all.records).toHaveLength(1)
    expect(all.records[0]).toMatchObject({ rid, v: 2, ts: 300 })
  })

  it('refuses a non-member, bad records and oversize requests', async () => {
    const { hid, secret, a } = await household()
    const good = { rid: newId(), ts: 1, data: blob() }
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: newId(), body: { records: [good] } })).status).toBe(403)
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ ...good, rid: 'bad' }] } })).status).toBe(400)
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ ...good, data: 'not base64url!' }] } })).status).toBe(400)
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ ...good, ts: -1 }] } })).status).toBe(400)
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [good, good] } })).status).toBe(400)
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: a, raw: '{nope' })).status).toBe(400)
    const many = Array.from({ length: MAX_RECORDS_PER_PUSH + 1 }, (_, i) => ({ rid: newId(), ts: i + 1, data: blob() }))
    expect((await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: many } })).status).toBe(413)
    const huge = await call('POST', `/v1/households/${hid}/push`, { secret, member: a, raw: JSON.stringify({ records: [{ ...good, data: 'A'.repeat(MAX_BODY_BYTES) }] }) })
    expect(huge.status).toBe(413)
    const bigRecord = await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records: [{ ...good, data: 'A'.repeat(70_000) }] } })
    expect(bigRecord.status).toBe(413)
  })

  it('enforces the per-household byte cap and rolls the push back', async () => {
    const { hid, secret, a } = await household()
    // 20 MB cap: 400 records of 60 kB each would be 24 MB. Push in batches of 7 (just under the body limit).
    let status = 200
    let pushed = 0
    for (let batch = 0; batch < 60 && status === 200; batch++) {
      const records = Array.from({ length: 7 }, (_, i) => ({ rid: newId(), ts: batch * 10 + i + 1, data: 'A'.repeat(60_000) }))
      const res = await call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records } })
      status = res.status
      if (status === 200) pushed += 7
    }
    expect(status).toBe(413)
    const info = (await (await call('GET', `/v1/households/${hid}`, { secret, member: a })).json()) as { version: number }
    // Only whole successful pushes were stored.
    expect(info.version).toBe(pushed)
  })

  it('limits new households per client address', async () => {
    const ip = '203.0.113.9'
    const codes: number[] = []
    for (let i = 0; i < 12; i++) codes.push((await call('POST', `/v1/households/${newId()}`, { secret: newSecret(), member: newId(), ip })).status)
    expect(codes.slice(0, 10).every((c) => c === 201)).toBe(true)
    expect(codes.slice(10)).toEqual([429, 429])
  })

  it('rate limits a household that hammers the server', async () => {
    const { hid, secret, a } = await household()
    let limited = false
    for (let i = 0; i < 200 && !limited; i++) {
      const res = await call('GET', `/v1/households/${hid}`, { secret, member: a })
      if (res.status === 429) limited = true
    }
    expect(limited).toBe(true)
  })
})

describe('tombstone purge', () => {
  it('purges old deletion markers and resets clients that were behind them', async () => {
    const { hid, secret, a } = await household()
    const kept = newId()
    const gone = newId()
    const later = newId()
    const push = (records: unknown[]) => call('POST', `/v1/households/${hid}/push`, { secret, member: a, body: { records } })
    const pull = async (since: number) => (await (await call('GET', `/v1/households/${hid}/changes?since=${since}`, { secret, member: a })).json()) as { records: { rid: string; v: number }[]; reset: boolean }
    await push([{ rid: kept, ts: 1, data: blob() }]) // v1
    await push([{ rid: gone, ts: 2, data: blob(), tomb: true }]) // v2
    // Age the tombstone past the 30-day limit; the next push purges it.
    await runInDurableObject(env.HOUSEHOLD.getByName(hid), async (_obj, state) => {
      state.storage.sql.exec(`UPDATE records SET stored_at = 0 WHERE tomb = 1`)
    })
    await push([{ rid: later, ts: 3, data: blob() }]) // v3
    const behind = await pull(1)
    expect(behind.reset).toBe(true)
    expect(behind.records.map((r) => r.rid)).toEqual([kept, later])
    const current = await pull(2)
    expect(current.reset).toBe(false)
    expect(current.records.map((r) => r.rid)).toEqual([later])
    expect((await pull(0)).reset).toBe(false)
  })
})

describe('CORS', () => {
  it('answers preflight for the web app and the Android app', async () => {
    for (const origin of ['https://joshdougherty12.github.io', 'https://localhost', 'capacitor://localhost']) {
      const res = await call('OPTIONS', `/v1/households/${newId()}/push`, { origin })
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin)
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Member')
    }
  })

  it('refuses other origins', async () => {
    const res = await call('OPTIONS', `/v1/households/${newId()}/push`, { origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    const { hid, secret, a } = await household()
    const get = await call('GET', `/v1/households/${hid}`, { secret, member: a, origin: 'https://evil.example' })
    expect(get.status).toBe(403)
  })

  it('adds the CORS header to real responses', async () => {
    const { hid, secret, a } = await household()
    const res = await call('GET', `/v1/households/${hid}`, { secret, member: a, origin: 'https://localhost' })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost')
  })
})
