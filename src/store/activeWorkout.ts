import { create } from 'zustand'
import { db } from '../db/db'
import { newId } from '../lib/id'
import type { ActiveWorkout, WorkoutLog } from '../types'

interface ActiveWorkoutState {
  active: ActiveWorkout | null
  loaded: boolean
  load: () => Promise<void>
  start: (workout: WorkoutLog) => Promise<void>
  /** Start a new, empty workout for a session. */
  startNew: (sessionTemplateId: string, date: string, weekNumber: number, deload?: boolean) => Promise<void>
  /** Apply a change and save it immediately. */
  update: (fn: (a: ActiveWorkout) => ActiveWorkout) => void
  /** Save the workout to history and clear the in-progress copy. Returns the saved log. */
  finish: () => Promise<WorkoutLog | null>
  discard: () => Promise<void>
}

/**
 * The in-progress workout. Every change is written to IndexedDB straight away,
 * so an accidental refresh or app close loses nothing.
 */
export const useActiveWorkout = create<ActiveWorkoutState>((set, get) => ({
  active: null,
  loaded: false,

  load: async () => {
    if (get().loaded) return
    const row = await db.activeWorkout.get('current')
    set({ active: row ? { ...row, drafts: row.drafts ?? {}, slotOverrides: row.slotOverrides ?? {} } : null, loaded: true })
  },

  start: async (workout) => {
    const a: ActiveWorkout = { id: 'current', workout, slotOverrides: {}, drafts: {}, updatedAt: Date.now() }
    await db.activeWorkout.put(a)
    set({ active: a, loaded: true })
  },

  startNew: (sessionTemplateId, date, weekNumber, deload) =>
    get().start({ id: newId('workout'), date, weekNumber, sessionTemplateId, ...(deload ? { deload: true } : {}), startedAt: Date.now(), notes: '', sets: [] }),

  update: (fn) => {
    const cur = get().active
    if (!cur) return
    const next = { ...fn(cur), updatedAt: Date.now() }
    set({ active: next })
    void db.activeWorkout.put(next)
  },

  finish: async () => {
    const cur = get().active
    if (!cur) return null
    const log: WorkoutLog = { ...cur.workout, finishedAt: Date.now() }
    await db.transaction('rw', db.workouts, db.activeWorkout, async () => {
      await db.workouts.put(log)
      await db.activeWorkout.delete('current')
    })
    set({ active: null })
    return log
  },

  discard: async () => {
    await db.activeWorkout.delete('current')
    set({ active: null })
  },
}))
