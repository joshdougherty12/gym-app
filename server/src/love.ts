/**
 * Daily notes for one household (Joshua to Sophie). The notes live only in the
 * LOVE_NOTES secret (a JSON array of strings), never in the app or this repo.
 * Only today's note is ever sent, "today" being the caller's local date from
 * Cloudflare's IP geolocation, so no future note can be asked for.
 *
 * Order: a shuffled cycle through every note with no repeats, then a fresh
 * shuffle for the next cycle.
 */

const EPOCH = Date.UTC(2026, 8, 29) // 2026-09-29, the first day

/** YYYY-MM-DD in a time zone (UTC if the zone is unknown). */
export function localDate(now: Date, timeZone: string | undefined): string {
  const fmt = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  try {
    return fmt(timeZone || 'UTC')
  } catch {
    return fmt('UTC')
  }
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - EPOCH) / 86_400_000)
}

/** FNV-1a over the notes, so the order changes if the list does. */
function seedOf(notes: readonly string[]): number {
  let h = 0x811c9dc5
  for (const ch of notes.join('\n')) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffledOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  const rand = mulberry32(seed)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j] as number, order[i] as number]
  }
  return order
}

/** The note for a date: position in this cycle's shuffle. */
export function pickNote(notes: readonly string[], date: string): string | undefined {
  const n = notes.length
  if (n === 0) return undefined
  const day = dayNumber(date)
  const cycle = Math.floor(day / n)
  const pos = ((day % n) + n) % n
  const order = shuffledOrder(n, (seedOf(notes) ^ Math.imul(cycle + 1, 0x9e3779b1)) >>> 0)
  return notes[order[pos] as number]
}

/** The LOVE_NOTES secret as a list; anything malformed means no notes. */
export function parseNotes(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
  } catch {
    return []
  }
}

/** Only households that existed before the cutoff, with both partners joined, get notes. */
export function noteEligible(members: number, createdAt: number, cutoffIso: string | undefined): boolean {
  const cutoff = cutoffIso ? Date.parse(cutoffIso) : NaN
  return members === 2 && Number.isFinite(cutoff) && createdAt > 0 && createdAt < cutoff
}
