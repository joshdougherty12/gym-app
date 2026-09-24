import { create } from 'zustand'

interface RestTimerState {
  /** Epoch ms when rest ends; null when no timer is running. */
  endsAt: number | null
  totalSec: number
  label: string
  start: (sec: number, label: string) => void
  adjust: (deltaSec: number) => void
  skip: () => void
}

const KEY = 'cutline-rest-timer'

function restore(): Pick<RestTimerState, 'endsAt' | 'totalSec' | 'label'> {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as { endsAt: number; totalSec: number; label: string }
      if (v.endsAt > Date.now()) return v
    }
  } catch {
    /* no storage: start without a timer */
  }
  return { endsAt: null, totalSec: 0, label: '' }
}

function persist(v: Pick<RestTimerState, 'endsAt' | 'totalSec' | 'label'>) {
  try {
    if (v.endsAt === null) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

/**
 * Rest timer stored as an end time, not a countdown, so it stays correct when
 * the phone sleeps or the tab is in the background.
 */
export const useRestTimer = create<RestTimerState>((set, get) => ({
  ...restore(),
  start: (sec, label) => {
    const v = { endsAt: Date.now() + sec * 1000, totalSec: sec, label }
    persist(v)
    set(v)
  },
  adjust: (d) => {
    const { endsAt, totalSec, label } = get()
    if (endsAt === null) return
    const v = { endsAt: Math.max(Date.now(), endsAt + d * 1000), totalSec: Math.max(0, totalSec + d), label }
    persist(v)
    set(v)
  },
  skip: () => {
    persist({ endsAt: null, totalSec: 0, label: '' })
    set({ endsAt: null, totalSec: 0, label: '' })
  },
}))
