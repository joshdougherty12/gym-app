import { db as defaultDb, type CutlineDB } from '../db/db'
import { nextTs } from '../lib/partner/merge'
import type { RecordType } from '../lib/partner/types'

const listeners = new Set<() => void>()

/** The sync engine listens here to push soon after a local edit. */
export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const syncKey = (type: string, id: string) => `${type}:${id}`

/**
 * Record that a shared record changed on this phone (edited, added or
 * deleted). Does nothing unless the phone is linked. Call it after the change
 * is saved, outside any other transaction.
 */
export async function markChanged(type: RecordType, ids: string | readonly string[], d: CutlineDB = defaultDb): Promise<void> {
  const list = typeof ids === 'string' ? [ids] : ids
  if (list.length === 0) return
  const changed = await d.transaction('rw', d.partner, d.syncMeta, d.syncOutbox, async () => {
    if (!(await d.partner.get('link'))) return false
    const now = Date.now()
    for (const id of list) {
      const key = syncKey(type, id)
      const meta = await d.syncMeta.get(key)
      await d.syncMeta.put({ key, ts: nextTs(meta?.ts, now) })
      await d.syncOutbox.put({ key, type, id, attempts: 0, nextAttemptAt: 0 })
    }
    return true
  })
  if (changed) for (const fn of listeners) fn()
}
