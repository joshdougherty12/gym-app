import { useLiveQuery } from 'dexie-react-hooks'
import { withAutoSteps, withManualSteps, type AutoSource, type StepImportDay } from '../lib/steps'
import type { StepDay } from '../types'
import { db as defaultDb, type CutlineDB } from './db'

/**
 * Save counted (Android) or imported (Apple Health) steps and fill each day's
 * check-in, unless a value was typed in that day. Returns the days whose
 * stored count changed.
 */
export async function saveAutoSteps(days: readonly StepImportDay[], source: AutoSource, d: CutlineDB = defaultDb): Promise<number> {
  if (!days.length) return 0
  return d.transaction('rw', d.steps, d.dailyLogs, async () => {
    let changed = 0
    const now = Date.now()
    for (const day of days) {
      const cur = await d.steps.get(day.date)
      if (!cur || cur.steps !== day.steps || cur.source !== source) {
        await d.steps.put({ date: day.date, steps: day.steps, source, updatedAt: now })
        changed++
      }
      const next = withAutoSteps(await d.dailyLogs.get(day.date), day.date, { steps: day.steps, source })
      if (next) await d.dailyLogs.put(next)
    }
    return changed
  })
}

/** Typed-in steps (a number) or clearing the field (undefined: go back to the counted or imported value). */
export async function setManualSteps(date: string, steps: number | undefined, d: CutlineDB = defaultDb): Promise<void> {
  await d.transaction('rw', d.steps, d.dailyLogs, async () => {
    const next = withManualSteps(await d.dailyLogs.get(date), date, steps, await d.steps.get(date))
    await d.dailyLogs.put(next)
  })
}

export function useStepDay(date: string): StepDay | undefined | null {
  return useLiveQuery(async () => (await defaultDb.steps.get(date)) ?? null, [date])
}
