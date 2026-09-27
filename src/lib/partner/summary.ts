import type { Exercise, WorkoutLog } from '../../types'
import { epley } from '../e1rm'
import { countedReps, findPRs } from '../history'
import type { WorkoutSummaryData } from './types'

/**
 * A finished workout as the partner sees it: session name, date, duration,
 * working sets, new records and the best set of up to four exercises.
 * Bodyweight is never included: records for added-load exercises (weighted
 * pull-ups, dips) are computed and shown on the added load only.
 */
export function workoutSummary(
  workout: WorkoutLog,
  earlier: readonly WorkoutLog[],
  exercises: Map<string, Pick<Exercise, 'name' | 'type' | 'loading'>>,
  sessionName: string,
): WorkoutSummaryData {
  const working = workout.sets.filter((s) => !s.isWarmup)
  // No bodyweight passed: e1RM of added-load lifts uses the added load alone.
  const prs = findPRs(workout, earlier, exercises).map((p) => {
    const e = exercises.get(p.exerciseId)
    return { exercise: e?.name ?? 'Exercise', kind: p.kind, valueLb: Math.round(p.value * 10) / 10, addedLoad: e?.loading === 'bodyweight-plus' }
  })
  const best: WorkoutSummaryData['best'] = []
  for (const id of [...new Set(working.map((s) => s.exerciseId))]) {
    const e = exercises.get(id)
    if (!e || e.type === 'timed' || e.type === 'cardio') continue
    const sets = working.filter((s) => s.exerciseId === id && countedReps(s) > 0)
    let top = sets[0]
    for (const s of sets) if (top && epley(s.weightLb, countedReps(s)) > epley(top.weightLb, countedReps(top))) top = s
    if (top) best.push({ exercise: e.name, weightLb: top.weightLb, reps: countedReps(top), addedLoad: e.loading === 'bodyweight-plus' })
    if (best.length === 4) break
  }
  const end = workout.finishedAt ?? workout.startedAt
  return {
    date: workout.date,
    name: sessionName,
    minutes: Math.max(0, Math.round((end - workout.startedAt) / 60_000)),
    setsDone: working.length,
    prs,
    best,
    finishedAt: end,
  }
}
