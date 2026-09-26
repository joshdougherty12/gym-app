import { useLiveQuery } from 'dexie-react-hooks'
import { describe, EXERCISE_LIBRARY } from '../data/exercises'
import { SESSION_TEMPLATES } from '../data/program'
import type { Exercise, SessionTemplate, Settings, WeekOverride } from '../types'
import { db, type CutlineDB } from './db'
import { withDefaults } from './defaults'

export async function getSettings(d: CutlineDB = db): Promise<Settings> {
  const row = await d.settings.get('app')
  if (!row) return withDefaults(undefined)
  const { id: _id, ...rest } = row
  return withDefaults(rest)
}

export async function updateSettings(patch: Partial<Settings>, d: CutlineDB = db): Promise<void> {
  await d.transaction('rw', d.settings, async () => {
    const current = await getSettings(d)
    await d.settings.put({ ...current, ...patch, id: 'app' })
  })
}

export async function saveSession(session: SessionTemplate, d: CutlineDB = db): Promise<void> {
  await d.sessions.put(session)
}

export async function saveExercise(exercise: Exercise, d: CutlineDB = db): Promise<void> {
  await d.exercises.put(exercise)
}

export async function saveWeekOverride(o: WeekOverride, d: CutlineDB = db): Promise<void> {
  await d.weekOverrides.put(o)
}

/** Put the program (sessions and exercise library) back to the shipped version. Logs are kept. */
export async function resetProgram(d: CutlineDB = db): Promise<void> {
  await d.transaction('rw', d.sessions, d.exercises, d.weekOverrides, async () => {
    await d.sessions.clear()
    await d.sessions.bulkAdd(structuredClone([...SESSION_TEMPLATES]))
    await d.exercises.clear()
    await d.exercises.bulkAdd(structuredClone([...EXERCISE_LIBRARY]))
    await d.weekOverrides.clear()
  })
}

/** Delete the whole database and start again as on first launch. */
export async function resetAllData(d: CutlineDB = db): Promise<void> {
  await d.delete()
  await d.open()
}

// ---- React hooks ---------------------------------------------------------

/** Settings, or undefined while the first read is in flight. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), [])
}

function withDescription(e: Exercise): Exercise {
  const d = describe(e)
  return d && !e.description ? { ...e, description: d } : e
}

export function useExercises(): Map<string, Exercise> | undefined {
  // Stored copies from before descriptions existed get the library text.
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, withDescription(e)])), [])
}

export function useSessions(): SessionTemplate[] | undefined {
  return useLiveQuery(() => db.sessions.toArray(), [])
}

export function useWeekOverride(weekNumber: number): WeekOverride | undefined {
  return useLiveQuery(() => db.weekOverrides.get(weekNumber), [weekNumber])
}

export function useWorkoutsForWeek(weekNumber: number) {
  return useLiveQuery(() => db.workouts.where('weekNumber').equals(weekNumber).toArray(), [weekNumber])
}
