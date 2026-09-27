// Last-writer-wins rules for shared records, and the retry schedule.
//
// Every shared record carries a timestamp. The server keeps a write only if
// its timestamp is newer than what it has; the phones apply a pulled record if
// its timestamp is at least their own. Both sides therefore settle on the same
// record. A local edit always gets a timestamp above the one it replaces, so an
// edit made after seeing the partner's change wins even if the clocks differ.

/** Timestamp for a local edit of a record whose last known timestamp is `prev`. */
export function nextTs(prev: number | undefined, now: number): number {
  return Math.max(Math.floor(now), (prev ?? 0) + 1)
}

/** Should a pulled record replace the local one? */
export function shouldApply(localTs: number | undefined, remoteTs: number): boolean {
  return localTs === undefined || remoteTs >= localTs
}

/** Wait before retrying a failed push: 2 s, 4 s, 8 s ... capped at 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(5 * 60_000, 2000 * 2 ** Math.max(0, attempts - 1))
}

export interface OutboxEntry {
  key: string
  type: string
  id: string
  attempts: number
  nextAttemptAt: number
}

/** Entries due now, oldest schedule first, at most `limit`. */
export function dueEntries(entries: readonly OutboxEntry[], now: number, limit: number): OutboxEntry[] {
  return entries
    .filter((e) => e.nextAttemptAt <= now)
    .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
    .slice(0, limit)
}

/** After a failed attempt. */
export function failed(e: OutboxEntry, now: number): OutboxEntry {
  const attempts = e.attempts + 1
  return { ...e, attempts, nextAttemptAt: now + backoffMs(attempts) }
}
