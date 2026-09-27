import { describe, expect, it } from 'vitest'
import { b64url, deriveKeys, openRecord, OpenError, randomBytes, recordId, sealRecord } from './crypto'

const HID = 'AAAAAAAAAAAAAAAAAAAAAA'
const env = { t: 'grocery', i: 'gi-1', d: { item: 'Oats', checked: false }, by: 'member-a' }

describe('partner record encryption', () => {
  it('round-trips a record', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const sealed = await sealRecord(keys, HID, env, 1234)
    expect(sealed.tomb).toBe(false)
    expect(sealed.data).not.toContain('Oats')
    expect(await openRecord(keys, HID, sealed)).toEqual(env)
  })

  it('uses a fresh IV for every write', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const a = await sealRecord(keys, HID, env, 1)
    const b = await sealRecord(keys, HID, env, 1)
    expect(a.data).not.toBe(b.data)
    expect(b64url.decode(a.data).subarray(0, 12)).not.toEqual(b64url.decode(b.data).subarray(0, 12))
  })

  it('gives each type+id a stable opaque id that reveals neither', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const rid = await recordId(keys, 'grocery', 'gi-1')
    expect(rid).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(await recordId(keys, 'grocery', 'gi-1')).toBe(rid)
    expect(await recordId(keys, 'recipe', 'gi-1')).not.toBe(rid)
    const other = await deriveKeys(randomBytes(32))
    expect(await recordId(other, 'grocery', 'gi-1')).not.toBe(rid)
  })

  it('marks deletions as tombstones', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const sealed = await sealRecord(keys, HID, { ...env, d: null }, 5)
    expect(sealed.tomb).toBe(true)
    expect((await openRecord(keys, HID, sealed)).d).toBeNull()
  })

  it('fails with the wrong key', async () => {
    const sealed = await sealRecord(await deriveKeys(randomBytes(32)), HID, env, 1)
    await expect(openRecord(await deriveKeys(randomBytes(32)), HID, sealed)).rejects.toBeInstanceOf(OpenError)
  })

  it('fails when the AAD changes: other household, record id or timestamp', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const sealed = await sealRecord(keys, HID, env, 1)
    await expect(openRecord(keys, 'BBBBBBBBBBBBBBBBBBBBBB', sealed)).rejects.toBeInstanceOf(OpenError)
    await expect(openRecord(keys, HID, { ...sealed, ts: 2 })).rejects.toBeInstanceOf(OpenError)
    const otherRid = await recordId(keys, 'grocery', 'gi-2')
    await expect(openRecord(keys, HID, { ...sealed, rid: otherRid })).rejects.toBeInstanceOf(OpenError)
  })

  it('fails when the IV, ciphertext or tag is altered', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const sealed = await sealRecord(keys, HID, env, 1)
    const bytes = b64url.decode(sealed.data)
    const flip = (at: number) => {
      const c = bytes.slice()
      c[at] = (c[at] ?? 0) ^ 1
      return { ...sealed, data: b64url.encode(c) }
    }
    await expect(openRecord(keys, HID, flip(0))).rejects.toBeInstanceOf(OpenError)
    await expect(openRecord(keys, HID, flip(20))).rejects.toBeInstanceOf(OpenError)
    await expect(openRecord(keys, HID, flip(bytes.length - 1))).rejects.toBeInstanceOf(OpenError)
    await expect(openRecord(keys, HID, { ...sealed, data: sealed.data.slice(0, 20) })).rejects.toBeInstanceOf(OpenError)
  })

  it('refuses a validly encrypted record whose type/id does not match its opaque id', async () => {
    const keys = await deriveKeys(randomBytes(32))
    const sealed = await sealRecord(keys, HID, env, 1)
    const forged = await sealRecord(keys, HID, { ...env, i: 'gi-9' }, 1)
    await expect(openRecord(keys, HID, { ...forged, rid: sealed.rid })).rejects.toBeInstanceOf(OpenError)
  })

  it('only accepts a 32-byte root key', async () => {
    await expect(deriveKeys(randomBytes(16))).rejects.toThrow()
  })
})
