import { describe, expect, it } from 'vitest'
import { b64url, randomBytes, randomId } from './crypto'
import { codeFromInput, crc32, decodeLinkCode, encodeLinkCode, LinkCodeError, linkUrl } from './pairing'

const parts = () => ({ householdId: randomId(), secret: b64url.encode(randomBytes(32)), rootKey: b64url.encode(randomBytes(32)) })

describe('link code', () => {
  it('round-trips and is URL-safe', () => {
    const p = parts()
    const code = encodeLinkCode(p)
    expect(code).toMatch(/^[A-Za-z0-9_-]{114}$/)
    expect(decodeLinkCode(code)).toEqual(p)
    expect(decodeLinkCode(`  ${code}\n`)).toEqual(p)
  })

  it('catches typos, truncation and junk', () => {
    const code = encodeLinkCode(parts())
    const typo = code.slice(0, 50) + (code[50] === 'A' ? 'B' : 'A') + code.slice(51)
    expect(() => decodeLinkCode(typo)).toThrow(LinkCodeError)
    expect(() => decodeLinkCode(code.slice(0, 100))).toThrow(/wrong length/)
    expect(() => decodeLinkCode('hello world!')).toThrow(LinkCodeError)
  })

  it('refuses another version', () => {
    const bytes = b64url.decode(encodeLinkCode(parts()))
    bytes[0] = 2
    new DataView(bytes.buffer).setUint32(81, crc32(bytes.subarray(0, 81)))
    expect(() => decodeLinkCode(b64url.encode(bytes))).toThrow(/different version/)
  })

  it('puts the code in the URL fragment and reads it back from a pasted link', () => {
    const code = encodeLinkCode(parts())
    const url = linkUrl('https://example.github.io/gym-app/', code)
    expect(url).toBe(`https://example.github.io/gym-app/#/link/${code}`)
    // Nothing secret in the path or query, which would reach the web server.
    expect(new URL(url).pathname).toBe('/gym-app/')
    expect(new URL(url).search).toBe('')
    expect(linkUrl('https://x.test/app/#/settings', code)).toBe(`https://x.test/app/#/link/${code}`)
    expect(codeFromInput(url)).toBe(code)
    expect(codeFromInput(`  ${code.slice(0, 60)}\n${code.slice(60)} `)).toBe(code)
  })

  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})
