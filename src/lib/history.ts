import { effectiveWeek } from '../data/program'
import type { Exercise, SetLog, WorkoutLog } from '../types'
import { effectiveLoad, epley } from './e1rm'
import type { PastSession, PastSet } from './progression'

/** Reps that count for progression: the weaker side for per-side sets. */
export function countedReps(s: Pick<SetLog, 'reps' | 'repsLeft' | 'repsRight'>): number {
  if (s.repsLeft !== undefined && s.repsRight !== undefined) return Math.min(s.repsLeft, s.repsRight)
  return s.reps
}

function toPastSet(s: SetLog): PastSet {
  return {
    weightLb: s.weightLb,
    reps: countedReps(s),
    rir: s.rir,
    ...(s.durationSec !== undefined ? { durationSec: s.durationSec } : {}),
  }
}

/**
 * Past sessions of one exercise, most recent first: finished workouts only,
 * working sets only, skipping `excludeWorkoutId` (the one in progress).
 */
export function exerciseHistory(workouts: readonly WorkoutLog[], exerciseId: string, excludeWorkoutId?: string): PastSession[] {
  return workouts
    .filter((w) => w.finishedAt !== undefined && w.id !== excludeWorkoutId)
    .map((w) => ({
      w,
      sets: w.sets.filter((s) => s.exerciseId === exerciseId && !s.isWarmup).sort((a, b) => a.setIndex - b.setIndex),
    }))
    .filter((x) => x.sets.length > 0)
    .sort((a, b) => (a.w.date === b.w.date ? b.w.startedAt - a.w.startedAt : a.w.date < b.w.date ? 1 : -1))
    .map(({ w, sets }) => ({ date: w.date, targetRir: effectiveWeek(w.weekNumber, w.deload).targetRir, sets: sets.map(toPastSet) }))
}

/** Total volume in lb: weight x reps over working sets (both sides for per-side sets). */
export function workoutVolume(sets: readonly SetLog[], exercises: Map<string, Pick<Exercise, 'type'>>): number {
  let v = 0
  for (const s of sets) {
    if (s.isWarmup) continue
    const e = exercises.get(s.exerciseId)
    if (!e || e.type === 'timed' || e.type === 'cardio') continue
    const reps = s.repsLeft !== undefined && s.repsRight !== undefined ? s.repsLeft + s.repsRight : s.reps
    v += s.weightLb * reps
  }
  return v
}

export interface PersonalRecord {
  exerciseId: string
  kind: 'e1rm' | 'weight'
  value: number
  previous: number
}

/**
 * Records set in `workout` compared with every earlier finished workout:
 * best estimated 1RM and heaviest working weight, per exercise. An exercise
 * with no earlier history sets no record (the first session is a baseline).
 */
export function findPRs(
  workout: WorkoutLog,
  earlier: readonly WorkoutLog[],
  exercises: Map<string, Pick<Exercise, 'type' | 'loading'>>,
  bodyweightLb?: number,
): PersonalRecord[] {
  const out: PersonalRecord[] = []
  const ids = [...new Set(workout.sets.filter((s) => !s.isWarmup).map((s) => s.exerciseId))]
  for (const id of ids) {
    const e = exercises.get(id)
    if (!e || e.type === 'timed' || e.type === 'cardio') continue
    const bwPlus = e.loading === 'bodyweight-plus'
    const best = (sets: SetLog[]) => ({
      e1rm: Math.max(0, ...sets.map((s) => epley(effectiveLoad(s.weightLb, bwPlus, bodyweightLb), countedReps(s)))),
      weight: Math.max(0, ...sets.map((s) => s.weightLb)),
    })
    const prevSets = earlier
      .filter((w) => w.id !== workout.id && w.finishedAt !== undefined)
      .flatMap((w) => w.sets.filter((s) => s.exerciseId === id && !s.isWarmup && countedReps(s) > 0))
    if (prevSets.length === 0) continue
    const now = best(workout.sets.filter((s) => s.exerciseId === id && !s.isWarmup && countedReps(s) > 0))
    const before = best(prevSets)
    if (now.e1rm > before.e1rm + 1e-9) out.push({ exerciseId: id, kind: 'e1rm', value: now.e1rm, previous: before.e1rm })
    if (now.weight > before.weight + 1e-9) out.push({ exerciseId: id, kind: 'weight', value: now.weight, previous: before.weight })
  }
  return out
}
