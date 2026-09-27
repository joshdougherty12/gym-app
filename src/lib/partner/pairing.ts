import { b64url } from './crypto'

// The link code carries everything the joining phone needs: the household id,
// the household secret the server checks, and the encryption root key.
// Layout: version (1) | household id (16) | secret (32) | root key (32) | CRC-32 (4)
// = 85 bytes, 114 base64url characters. In the QR code it rides in the URL
// fragment (#/link/<code>), which browsers never send to any server.

export interface LinkCode {
  householdId: string
  secret: string
  rootKey: string
}

const VERSION = 1
const LEN = 1 + 16 + 32 + 32 + 4

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function encodeLinkCode(c: LinkCode): string {
  const hid = b64url.decode(c.householdId)
  const secret = b64url.decode(c.secret)
  const key = b64url.decode(c.rootKey)
  if (hid.length !== 16 || secret.length !== 32 || key.length !== 32) throw new Error('Bad link parts')
  const out = new Uint8Array(LEN)
  out[0] = VERSION
  out.set(hid, 1)
  out.set(secret, 17)
  out.set(key, 49)
  new DataView(out.buffer).setUint32(81, crc32(out.subarray(0, 81)))
  return b64url.encode(out)
}

export class LinkCodeError extends Error {}

export function decodeLinkCode(code: string): LinkCode {
  let bytes: Uint8Array
  try {
    bytes = b64url.decode(code.trim())
  } catch {
    throw new LinkCodeError('That code has characters a link code never has. Copy it again.')
  }
  if (bytes.length !== LEN) throw new LinkCodeError('That code is the wrong length. Copy the whole code and try again.')
  if (bytes[0] !== VERSION) throw new LinkCodeError('That code is from a different version of the app. Update both phones.')
  if (new DataView(bytes.buffer, bytes.byteOffset).getUint32(81) !== crc32(bytes.subarray(0, 81))) throw new LinkCodeError('That code has a typo. Copy it again.')
  return {
    householdId: b64url.encode(bytes.subarray(1, 17)),
    secret: b64url.encode(bytes.subarray(17, 49)),
    rootKey: b64url.encode(bytes.subarray(49, 81)),
  }
}

/** The QR/share link: opens the web app straight at the link screen. */
export function linkUrl(webAppUrl: string, code: string): string {
  const base = webAppUrl.split('#')[0] ?? webAppUrl
  return `${base}#/link/${code}`
}

/** Accept either a pasted link or the bare code. */
export function codeFromInput(text: string): string {
  const t = text.trim()
  const m = /\/link\/([A-Za-z0-9_-]+)/.exec(t)
  return m?.[1] ?? t.replace(/\s+/g, '')
}
