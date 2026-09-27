// End-to-end encryption for partner sync (WebCrypto only).
//
// Each household has a random 256-bit root key made on the phone that creates
// it; it travels only inside the link code. Two keys are derived from it with
// HKDF-SHA-256: an AES-256-GCM key that encrypts every record, and an HMAC key
// that turns a record's type and id into the opaque record id the server sees.
// The server stores ciphertext, that opaque id, a version and a timestamp.

export const b64url = {
  encode(bytes: Uint8Array): string {
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  decode(s: string): Uint8Array<ArrayBuffer> {
    if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('Not base64url')
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const out = new Uint8Array(new ArrayBuffer(bin.length))
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  },
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)))
}

/** 16 random bytes as base64url (22 characters): household and member ids. */
export const randomId = () => b64url.encode(randomBytes(16))

export interface HouseholdKeys {
  enc: CryptoKey
  ids: CryptoKey
}

const enc = new TextEncoder()

/** Derive the record key and the id key from the household's root key. Neither can be exported. */
export async function deriveKeys(rootKey: Uint8Array<ArrayBuffer>): Promise<HouseholdKeys> {
  if (rootKey.length !== 32) throw new Error('Root key must be 32 bytes')
  const base = await crypto.subtle.importKey('raw', rootKey, 'HKDF', false, ['deriveKey'])
  const params = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) })
  const encKey = await crypto.subtle.deriveKey(params('partner-sync/v1/records'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const idKey = await crypto.subtle.deriveKey(params('partner-sync/v1/record-ids'), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'])
  return { enc: encKey, ids: idKey }
}

/** Opaque record id: the first 16 bytes of HMAC(type, id). Stable, and meaningless to the server. */
export async function recordId(keys: HouseholdKeys, type: string, id: string): Promise<string> {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', keys.ids, enc.encode(`${type}\n${id}`)))
  return b64url.encode(mac.subarray(0, 16))
}

/** What is inside each ciphertext. `d: null` marks a deleted record. */
export interface Envelope {
  t: string
  i: string
  d: unknown
  by: string
}

export interface SealedRecord {
  rid: string
  ts: number
  tomb: boolean
  data: string
}

// Additional authenticated data: the household, the record id (a keyed hash
// of type + id) and the timestamp. Moving a ciphertext to another record,
// household or time makes it fail to decrypt.
const aad = (householdId: string, rid: string, ts: number) => enc.encode(`rt-sync/v1|${householdId}|${rid}|${ts}`)

export async function sealRecord(keys: HouseholdKeys, householdId: string, env: Envelope, ts: number): Promise<SealedRecord> {
  const rid = await recordId(keys, env.t, env.i)
  const iv = randomBytes(12)
  const plain = enc.encode(JSON.stringify(env))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(householdId, rid, ts) }, keys.enc, plain))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv)
  out.set(ct, 12)
  return { rid, ts, tomb: env.d === null, data: b64url.encode(out) }
}

export class OpenError extends Error {}

/**
 * Decrypt and check a record. Throws OpenError if the ciphertext, its
 * AAD or the key are wrong, or if the record's type and id do not match its opaque id.
 */
export async function openRecord(keys: HouseholdKeys, householdId: string, r: { rid: string; ts: number; data: string }): Promise<Envelope> {
  let plain: ArrayBuffer
  try {
    const bytes = b64url.decode(r.data)
    if (bytes.length < 12 + 16) throw new Error('short')
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: aad(householdId, r.rid, r.ts) }, keys.enc, bytes.subarray(12))
  } catch {
    throw new OpenError('Record failed to decrypt')
  }
  let env: unknown
  try {
    env = JSON.parse(new TextDecoder().decode(plain))
  } catch {
    throw new OpenError('Record is not JSON')
  }
  if (typeof env !== 'object' || env === null) throw new OpenError('Bad envelope')
  const e = env as Record<string, unknown>
  if (typeof e.t !== 'string' || typeof e.i !== 'string' || typeof e.by !== 'string' || !('d' in e)) throw new OpenError('Bad envelope')
  if ((await recordId(keys, e.t, e.i)) !== r.rid) throw new OpenError('Record id mismatch')
  return { t: e.t, i: e.i, d: e.d, by: e.by }
}
