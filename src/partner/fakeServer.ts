import type { SyncDeps } from './api'

// An in-memory stand-in for the sync server (same routes and rules as
// server/src), for unit tests of the sync engine. The real server has its own
// tests in server/test; the two were checked against each other end to end.

interface Row {
  rid: string
  v: number
  ts: number
  data: string
}

interface House {
  hash: string
  members: Set<string>
  version: number
  rows: Map<string, Row>
  closed: boolean
}

export class FakeServer {
  houses = new Map<string, House>()
  /** When set, every request fails as if offline. */
  offline = false
  requests = 0

  deps(): SyncDeps {
    return { baseUrl: 'https://fake.sync', fetch: (url, init) => this.handle(url, init) }
  }

  private async handle(url: string, init: RequestInit): Promise<Response> {
    this.requests++
    if (this.offline) throw new TypeError('Failed to fetch')
    const u = new URL(url)
    const m = /^\/v1\/households\/([A-Za-z0-9_-]{22})(?:\/(join|push|changes))?$/.exec(u.pathname)
    const headers = new Headers(init.headers)
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (!m) return reply(404, { error: 'not_found' })
    const hid = m[1] as string
    const action = m[2]
    const secret = (headers.get('Authorization') ?? '').replace('Bearer ', '')
    const member = headers.get('X-Member') ?? ''
    const method = init.method ?? 'GET'
    let h = this.houses.get(hid)
    if (!action && method === 'POST') {
      if (h) return reply(h.closed ? 410 : 409, { error: 'household_exists' })
      h = { hash: secret, members: new Set([member]), version: 0, rows: new Map(), closed: false }
      this.houses.set(hid, h)
      return reply(201, { members: 1 })
    }
    if (!h) return reply(404, { error: 'no_household' })
    if (h.closed) return reply(410, { error: 'household_closed' })
    if (h.hash !== secret) return reply(401, { error: 'bad_secret' })
    if (!action && method === 'DELETE') {
      h.closed = true
      h.rows.clear()
      h.members.clear()
      return reply(200, { ok: true })
    }
    if (action === 'join') {
      if (!h.members.has(member)) {
        if (h.members.size >= 2) return reply(403, { error: 'household_full' })
        h.members.add(member)
      }
      return reply(200, { members: h.members.size })
    }
    if (!h.members.has(member)) return reply(403, { error: 'not_a_member' })
    if (!action) return reply(200, { members: h.members.size, version: h.version })
    if (action === 'push') {
      const body = JSON.parse(String(init.body)) as { records: { rid: string; ts: number; data: string }[] }
      const accepted: string[] = []
      const stale: string[] = []
      for (const r of body.records) {
        const cur = h.rows.get(r.rid)
        if (cur && cur.ts >= r.ts) {
          stale.push(r.rid)
          continue
        }
        h.version++
        h.rows.set(r.rid, { rid: r.rid, v: h.version, ts: r.ts, data: r.data })
        accepted.push(r.rid)
      }
      return reply(200, { accepted, stale, version: h.version })
    }
    const since = Number(u.searchParams.get('since') ?? '0')
    const limit = Number(u.searchParams.get('limit') ?? '200')
    const rows = [...h.rows.values()].filter((r) => r.v > since).sort((a, b) => a.v - b.v)
    const page = rows.slice(0, limit)
    const last = page[page.length - 1]
    return reply(200, { records: page, cursor: last ? last.v : Math.max(since, h.version), more: rows.length > limit, reset: false })
  }
}
