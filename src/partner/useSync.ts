import { useEffect } from 'react'
import { create } from 'zustand'
import { db } from '../db/db'
import { notifyPartner } from '../lib/native'
import { partnerAvailable } from './config'
import { syncOnce, type SyncResult } from './engine'
import { onLocalChange } from './outbox'
import { eventText } from './present'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error'

interface SyncStatus {
  state: SyncState
  lastOkAt?: number
  /** Set when the partner unlinked (shown once in Settings and on Today). */
  partnerLeft: boolean
  set: (p: Partial<Omit<SyncStatus, 'set'>>) => void
}

export const useSyncStatus = create<SyncStatus>((set) => ({
  state: 'idle',
  partnerLeft: false,
  set: (p) => set(p),
}))

let running: Promise<void> | null = null
let again = false

/** Sync now (one at a time; a request during a sync runs once more after it). */
export function syncNow(): Promise<void> {
  if (!partnerAvailable()) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const s = useSyncStatus.getState()
      if (s.state !== 'syncing') s.set({ state: 'syncing' })
      let res: SyncResult
      try {
        res = await syncOnce()
      } catch {
        res = { state: 'error', newEvents: [], pending: 0 }
      }
      apply(res)
      await announce(res)
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

function apply(res: SyncResult) {
  const set = useSyncStatus.getState().set
  if (res.state === 'gone') return set({ state: 'idle', partnerLeft: true })
  if (res.state === 'off') return set({ state: 'idle' })
  if (res.state === 'synced') return set({ state: 'synced', lastOkAt: Date.now() })
  set({ state: res.state })
}

/** Android: a notification for each new high-five, nudge or "ate this". The web app shows them in-app only. */
async function announce(res: SyncResult) {
  const link = await db.partner.get('link')
  if (!link) return
  const partner = (await db.partnerRecords.get(`member:${res.newEvents[0]?.by ?? ''}`))?.data as { name?: string } | undefined
  for (const e of res.newEvents) {
    if (e.notified) continue
    const text = eventText(e.data, partner?.name || 'Your partner')
    if (text) await notifyPartner(text.title, text.body)
    await db.partnerRecords.update(e.key, { notified: true })
  }
}

let debounce: number | undefined

/**
 * Keep the partner link in sync while the app is open: at start, when the
 * app comes back to the foreground, every 30 s while visible, and shortly
 * after any shared change.
 */
export function usePartnerSync(): void {
  useEffect(() => {
    if (!partnerAvailable()) return
    const visible = () => document.visibilityState === 'visible'
    void syncNow()
    const onVisible = () => {
      if (visible()) void syncNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    const timer = window.setInterval(() => {
      if (visible()) void syncNow()
    }, 30_000)
    const off = onLocalChange(() => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void syncNow(), 1500)
    })
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
      window.clearInterval(timer)
      window.clearTimeout(debounce)
      off()
    }
  }, [])
}
