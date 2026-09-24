import { MUSCLES, type DailyLog, type Exercise, type Muscle, type Schedule, type WorkoutLog } from '../types'
import { daysBetween, weekdayOf, type IsoDate } from './dates'

export const WEEKLY_SET_TARGET = 10

/**
 * Hard sets per muscle for the workouts given (usually one program week):
 * each working set counts 1 for its primary muscles and 0.5 for secondary.
 * Warm-ups and cardio don't count.
 */
export function setsPerMuscle(workouts: readonly WorkoutLog[], exercises: Map<string, Pick<Exercise, 'type' | 'primaryMuscles' | 'secondaryMuscles'>>): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const w of workouts) {
    for (const s of w.sets) {
      if (s.isWarmup) continue
      const e = exercises.get(s.exerciseId)
      if (!e || e.type === 'cardio') continue
      for (const m of e.primaryMuscles) out[m] += 1
      for (const m of e.secondaryMuscles) out[m] += 0.5
    }
  }
  return out
}

export interface WeekAdherence {
  week: number
  planned: number
  completed: number
  stepDays: number
  stepHits: number
}

/**
 * Workouts completed vs planned for one program week, counting only days up
 * to `today`, plus how many logged step days hit the goal.
 */
export function weekAdherence(args: {
  week: number
  dates: readonly IsoDate[]
  today: IsoDate
  schedule: Schedule
  workouts: readonly WorkoutLog[]
  dailyLogs: readonly DailyLog[]
  stepGoal: number
}): WeekAdherence {
  const past = args.dates.filter((d) => daysBetween(d, args.today) >= 0)
  const planned = past.filter((d) => args.schedule[weekdayOf(d)].kind === 'session').length
  const done = args.workouts.filter((w) => w.weekNumber === args.week && w.finishedAt !== undefined)
  const completed = Math.min(planned || done.length, new Set(done.map((w) => w.date + w.sessionTemplateId)).size)
  const inWeek = new Set(past)
  const steps = args.dailyLogs.filter((d) => inWeek.has(d.date) && d.steps !== undefined)
  return {
    week: args.week,
    planned,
    completed,
    stepDays: steps.length,
    stepHits: steps.filter((d) => (d.steps ?? 0) >= args.stepGoal).length,
  }
}
