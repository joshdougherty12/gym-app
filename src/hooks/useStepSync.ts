import { useEffect } from 'react'
import { create } from 'zustand'
import { saveAutoSteps } from '../db/steps'
import { addDays, todayIso } from '../lib/dates'
import { getDailySteps, getStepStatus, sampleStepsNow, stepCounterSupported, type StepStatus } from '../lib/stepCounter'

interface StepState {
  /** Null until the first check (and always on the web). */
  status: StepStatus | null
  set: (s: StepStatus) => void
}

export const useStepStatus = create<StepState>((set) => ({ status: null, set: (status) => set({ status }) }))

/** Days read back from the phone on each refresh (covers a week or two of not opening the app). */
const LOOKBACK_DAYS = 14

let busy: Promise<void> | null = null

/** Take a fresh reading and copy the phone's daily totals into the log. */
export function refreshSteps(): Promise<void> {
  if (!stepCounterSupported()) return Promise.resolve()
  busy ??= (async () => {
    try {
      const status = await sampleStepsNow()
      useStepStatus.getState().set(status)
      if (!status.enabled) return
      const today = todayIso()
      const days = (await getDailySteps(addDays(today, -LOOKBACK_DAYS), today)).filter((d) => d.steps > 0)
      await saveAutoSteps(days, 'sensor')
    } catch {
      /* try again on the next tick */
    }
  })().finally(() => {
    busy = null
  })
  return busy
}

/** Android: read steps when the app opens, when it comes back to the front, and every minute while it is open. */
export function useStepSync(): void {
  useEffect(() => {
    if (!stepCounterSupported()) return
    void getStepStatus().then((s) => useStepStatus.getState().set(s))
    void refreshSteps()
    const visible = () => document.visibilityState === 'visible'
    const onVisible = () => {
      if (visible()) void refreshSteps()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(onVisible, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [])
}
