import { env, exports } from 'cloudflare:workers'
import { runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { localDate, noteEligible, parseNotes, pickNote } from '../src/love'

const worker = exports.default as unknown as { fetch: (req: Request) => Promise<Response> }
const rand = (n: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('daily note order', () => {
  const notes = Array.from({ length: 39 }, (_, i) => `note ${i}`)
  const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10))

  it('shows every note once per cycle, in a shuffled order', () => {
    const cycle = days('2026-09-29', 39).map((d) => pickNote(notes, d))
    expect(new Set(cycle).size).toBe(39)
    expect(cycle).not.toEqual(notes)
  })

  it('reshuffles the next cycle, and the same date always gives the same note', () => {
    const first = days('2026-09-29', 39).map((d) => pickNote(notes, d))
    const second = days('2026-11-07', 39).map((d) => pickNote(notes, d))
    expect(new Set(second).size).toBe(39)
    expect(second).not.toEqual(first)
    expect(pickNote(notes, '2026-10-05')).toBe(pickNote(notes, '2026-10-05'))
  })

  it('uses the caller’s local date', () => {
    const t = new Date('2026-09-30T03:30:00Z')
    expect(localDate(t, 'America/Chicago')).toBe('2026-09-29')
    expect(localDate(t, 'Asia/Tokyo')).toBe('2026-09-30')
    expect(localDate(t, 'Not/AZone')).toBe('2026-09-30')
    expect(localDate(t, undefined)).toBe('2026-09-30')
  })

  it('reads the secret and checks the household', () => {
    expect(parseNotes('["a", "", 3, "b"]')).toEqual(['a', 'b'])
    expect(parseNotes('nope')).toEqual([])
    expect(parseNotes(undefined)).toEqual([])
    const before = Date.parse('2026-09-28T12:00:00Z')
    expect(noteEligible(2, before, '2026-09-29T00:00:00Z')).toBe(true)
    expect(noteEligible(1, before, '2026-09-29T00:00:00Z')).toBe(false)
    expect(noteEligible(2, Date.parse('2026-10-01T00:00:00Z'), '2026-09-29T00:00:00Z')).toBe(false)
    expect(noteEligible(2, before, undefined)).toBe(false)
  })
})

describe('GET /note', () => {
  async function linkedHousehold(createdAt: number) {
    const hid = rand(16)
    const secret = rand(32)
    const [a, b] = [rand(16), rand(16)]
    const call = (method: string, path: string, member: string) =>
      worker.fetch(new Request(`https://sync.test/v1/households/${hid}${path}`, { method, headers: { Authorization: `Bearer ${secret}`, 'X-Member': member, 'CF-Connecting-IP': rand(8) } }))
    expect((await call('POST', '', a)).status).toBe(201)
    expect((await call('POST', '/join', b)).status).toBe(200)
    await runInDurableObject(env.HOUSEHOLD.getByName(hid), async (_o, state) => {
      state.storage.sql.exec(`UPDATE meta SET v = ? WHERE k = 'created_at'`, String(createdAt))
    })
    return { call, a, b }
  }

  it('gives the original household today’s note', async () => {
    const { call, b } = await linkedHousehold(Date.parse('2026-09-20T00:00:00Z'))
    const res = await call('GET', '/note', b)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { date: string; text: string }
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(['note one', 'note two', 'note three']).toContain(body.text)
  })

  it('gives newer households nothing', async () => {
    const { call, a } = await linkedHousehold(Date.parse('2026-10-02T00:00:00Z'))
    const res = await call('GET', '/note', a)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'no_note' })
  })

  it('needs the household secret', async () => {
    const res = await worker.fetch(new Request(`https://sync.test/v1/households/${rand(16)}/note`, { headers: { Authorization: `Bearer ${rand(32)}`, 'X-Member': rand(16) } }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'no_household' })
  })
})
