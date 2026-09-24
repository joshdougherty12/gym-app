import type { DraftSet, Exercise, ExerciseSlot, RirRange, SessionTemplate, SetLog, SlotOverride, WeekDefinition, WeekOverride, WorkoutLog } from '../types'
import { exerciseHistory } from './history'
import { suggest, type PastSession, type Suggestion } from './progression'
import { roundTo } from './units'
import { plannedSets, targetRirForSet } from './weekPlan'

export interface SlotPlan {
  slot: ExerciseSlot
  exercise: Exercise
  workingSets: number
  warmups: number
  suggestion: Suggestion
  history: PastSession[]
  targetRir: RirRange[]
  /** Reasons the set count differs from the template (deload, bonus sets...). */
  setReasons: string[]
}

export function planWorkout(args: {
  session: SessionTemplate
  exercises: Map<string, Exercise>
  week: WeekDefinition
  weekOverride?: WeekOverride
  slotOverrides: Record<string, SlotOverride>
  workouts: readonly WorkoutLog[]
  activeWorkoutId: string
  formatWeight?: (lb: number) => string
}): SlotPlan[] {
  const out: SlotPlan[] = []
  for (const templateSlot of args.session.slots) {
    const o = args.slotOverrides[templateSlot.slotId] ?? {}
    const exercise = args.exercises.get(o.exerciseId ?? templateSlot.exerciseId)
    if (!exercise) continue
    const slot = withCardioBump(templateSlot, exercise, args.week, args.weekOverride)
    const planned = plannedSets(slot, exercise, args.week, args.weekOverride)
    if (slot !== templateSlot) planned.reasons.push('+5 min (cardio bump)')
    const workingSets = exercise.type === 'cardio' ? 1 : Math.max(1, planned.sets + (o.setDelta ?? 0))
    const history = exerciseHistory(args.workouts, exercise.id, args.activeWorkoutId)
    const targetRir = Array.from({ length: workingSets }, (_, i) => targetRirForSet(args.week, slot, i, workingSets))
    const suggestion = suggest({
      exercise,
      repMin: slot.repMin,
      repMax: slot.repMax,
      sets: workingSets,
      phase: args.week.phase,
      todayRir: args.week.targetRir,
      history,
      ...(args.formatWeight ? { formatWeight: args.formatWeight } : {}),
    })
    out.push({ slot, exercise, workingSets, warmups: o.warmups ?? 0, suggestion, history, targetRir, setReasons: planned.reasons })
  }
  return out
}

/** Weeks 5-8 (and extension weeks): the "longer finisher" cardio bump adds 5 minutes to conditioning. */
export function withCardioBump(slot: ExerciseSlot, exercise: Pick<Exercise, 'type'>, week: WeekDefinition, override?: WeekOverride): ExerciseSlot {
  if (exercise.type !== 'cardio' || override?.cardioBump !== 'longer-finisher') return slot
  if (week.phase !== 'push' && week.phase !== 'extension') return slot
  return { ...slot, repMin: slot.repMin + 5, repMax: slot.repMax + 5 }
}

export function rowKey(slotId: string, exerciseId: string, warmup: boolean, index: number): string {
  return `${slotId}|${exerciseId}|${warmup ? 'w' : 's'}|${index}`
}

export function findLogged(sets: readonly SetLog[], slotId: string, exerciseId: string, warmup: boolean, index: number): SetLog | undefined {
  return sets.find((s) => s.slotId === slotId && s.exerciseId === exerciseId && s.isWarmup === warmup && s.setIndex === index)
}

/**
 * Pre-filled values for an unlogged row. Working sets use the suggestion; if
 * there is no suggested weight (first session) they reuse the weight of the
 * last set already logged for this exercise today.
 */
export function defaultDraft(plan: SlotPlan, loggedToday: readonly SetLog[], warmup: boolean, index: number): DraftSet {
  const { exercise, slot, suggestion } = plan
  const mine = loggedToday.filter((s) => s.slotId === slot.slotId && s.exerciseId === exercise.id)
  const lastWorking = [...mine].filter((s) => !s.isWarmup).sort((a, b) => b.loggedAt - a.loggedAt)[0]
  const target = suggestion.sets[Math.min(index, suggestion.sets.length - 1)]
  const suggestedWeight = target?.weightLb ?? null
  const workingWeight = lastWorking?.weightLb ?? suggestedWeight ?? 0

  if (exercise.type === 'cardio') {
    return { weightLb: 0, reps: 0, rir: 0, durationSec: slot.repMin * 60 }
  }
  if (warmup) {
    const w = exercise.incrementLb > 0 ? roundTo(workingWeight * 0.5, exercise.incrementLb) : 0
    return { weightLb: w, reps: exercise.type === 'timed' ? 0 : 8, rir: 5, ...(exercise.type === 'timed' ? { durationSec: 20 } : {}) }
  }
  const rir = plan.targetRir[index]?.min ?? 2
  const reps = target?.reps ?? slot.repMin
  const weightLb = lastWorking && suggestedWeight === null ? lastWorking.weightLb : (suggestedWeight ?? workingWeight)
  if (exercise.type === 'timed') return { weightLb, reps: 0, rir, durationSec: reps }
  if (exercise.perSide) return { weightLb, reps, repsLeft: reps, repsRight: reps, rir }
  return { weightLb, reps, rir }
}

/** Best working set from any session in a given program week (for "beat week 8"). */
export function bestSetInWeek(workouts: readonly WorkoutLog[], exerciseId: string, weekNumber: number): SetLog | undefined {
  let best: SetLog | undefined
  let bestScore = -1
  for (const w of workouts) {
    if (w.weekNumber !== weekNumber || w.finishedAt === undefined) continue
    for (const s of w.sets) {
      if (s.exerciseId !== exerciseId || s.isWarmup) continue
      const score = s.weightLb * (1 + s.reps / 30)
      if (score > bestScore) {
        bestScore = score
        best = s
      }
    }
  }
  return best
}
