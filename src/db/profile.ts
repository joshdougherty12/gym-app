import { EXERCISE_LIBRARY, exerciseMap } from '../data/exercises'
import { generateProgram, type GeneratedProgram } from '../lib/programGen'
import { heartHealthy, targetsFor } from '../lib/targets'
import type { Exercise, Profile, ReminderSettings } from '../types'
import { db as defaultDb, type CutlineDB } from './db'
import { DEFAULT_FOOD_NOTES } from './defaults'
import { getSettings } from './repo'

export interface ApplyOptions {
  updateTargets: boolean
  rebuildProgram: boolean
  /** Restart the program calendar today (new users). */
  startToday: boolean
  reminders?: ReminderSettings
}

export async function libraryMap(d: CutlineDB = defaultDb): Promise<Map<string, Exercise>> {
  const stored = await d.exercises.toArray()
  return stored.length ? exerciseMap(stored.map((e) => ({ ...e, cautions: e.cautions ?? EXERCISE_LIBRARY.find((x) => x.id === e.id)?.cautions }))) : exerciseMap(EXERCISE_LIBRARY)
}

export function previewProgram(p: Profile, lib: Map<string, Exercise>): GeneratedProgram {
  return generateProgram(p, lib)
}

/** Save a profile and, as chosen, apply its targets, program and reminders. */
export async function applyProfile(p: Profile, opts: ApplyOptions, today: string, d: CutlineDB = defaultDb): Promise<void> {
  const lib = await libraryMap(d)
  const program = opts.rebuildProgram ? generateProgram(p, lib) : null
  await d.transaction('rw', d.settings, d.sessions, d.weekOverrides, async () => {
    const cur = await getSettings(d)
    const notes =
      cur.profile || cur.foodNotes !== DEFAULT_FOOD_NOTES
        ? cur.foodNotes
        : heartHealthy(p.healthNotes)
          ? DEFAULT_FOOD_NOTES
          : 'Budget-friendly, easy to cook, high in protein.'
    await d.settings.put({
      ...cur,
      profile: p,
      foodNotes: notes,
      ...(opts.updateTargets ? targetsFor(p) : {}),
      ...(program ? { schedule: program.schedule } : {}),
      ...(opts.startToday ? { startDate: today, pauses: [] } : {}),
      ...(opts.reminders ? { reminders: opts.reminders } : {}),
      id: 'app',
    })
    if (program) {
      await d.sessions.clear()
      await d.sessions.bulkPut(program.sessions)
      await d.weekOverrides.clear()
    }
  })
}
