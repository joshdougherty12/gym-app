import type { Exercise, ExerciseSlot, MovementPattern, RirRange, WeekDefinition, WeekOverride } from '../types'

/** Patterns that get a 4th set automatically in weeks 5-8. */
const PUSH_PHASE_BONUS: readonly MovementPattern[] = ['lateral-raise', 'rear-delt']

/** Patterns covered by the optional weeks 1-4 "shoulders and core" extra set. */
const SHOULDERS_CORE: readonly MovementPattern[] = ['vertical-press', 'lateral-raise', 'rear-delt', 'core']

/** Deload sets: about 40% fewer, rounded to nearest, never below 1. */
export function deloadSets(sets: number, multiplier = 0.6): number {
  if (sets <= 0) return 0
  return Math.max(1, Math.round(sets * multiplier))
}

export interface SetPlan {
  sets: number
  /** Human-readable reasons for any change from the template. */
  reasons: string[]
}

/**
 * Working sets for a slot in a given week, from the template plus phase rules
 * and the week's choices. Cardio slots are never changed here.
 */
export function plannedSets(
  slot: ExerciseSlot,
  exercise: Exercise,
  week: WeekDefinition,
  override?: WeekOverride,
): SetPlan {
  const reasons: string[] = []
  let sets = slot.sets
  if (exercise.type === 'cardio') return { sets, reasons }

  if (week.phase === 'deload') {
    const d = deloadSets(sets, week.setMultiplier)
    if (d !== sets) reasons.push(`Deload: ${sets} → ${d} sets, same weight`)
    return { sets: d, reasons }
  }

  if ((week.phase === 'push' || week.phase === 'extension') && PUSH_PHASE_BONUS.includes(exercise.pattern)) {
    sets += 1
    reasons.push('+1 set (push phase)')
  }
  if (
    (week.phase === 'push' || week.phase === 'extension') &&
    override?.weakestLiftSlotId === slot.slotId
  ) {
    sets += 1
    reasons.push('+1 set (weakest lift)')
  }
  if (
    (week.phase === 'base' || week.phase === 'intro') &&
    override?.shouldersCoreBonus &&
    SHOULDERS_CORE.includes(exercise.pattern)
  ) {
    sets += 1
    reasons.push('+1 set (shoulders/core bonus)')
  }
  const extra = override?.extraSets[slot.slotId] ?? 0
  if (extra !== 0) {
    sets = Math.max(1, sets + extra)
    reasons.push(`${extra > 0 ? '+' : ''}${extra} set${Math.abs(extra) === 1 ? '' : 's'} (edited)`)
  }
  return { sets, reasons }
}

/** Target RIR for one set. In peak weeks the last set of a main lift goes harder. */
export function targetRirForSet(week: WeekDefinition, slot: ExerciseSlot, setIndex: number, totalSets: number): RirRange {
  if (week.mainLiftLastSetRir && slot.isMainLift && setIndex === totalSets - 1) {
    return week.mainLiftLastSetRir
  }
  return week.targetRir
}

export function formatRir(r: RirRange): string {
  return r.min === r.max ? `${r.min} RIR` : `${r.min}-${r.max} RIR`
}

export function formatRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}-${max}`
}

/** "4 × 6-8", "3 × 45-60 s", "3 × 10 / leg", "10 min". */
export function formatSlotTarget(slot: ExerciseSlot, exercise: Exercise, sets = slot.sets): string {
  const range = formatRange(slot.repMin, slot.repMax)
  if (exercise.type === 'cardio') return `${range} min`
  const unit = exercise.type === 'timed' ? ' s' : ''
  const side = exercise.perSide ? (exercise.pattern === 'lunge' ? ' / leg' : ' / side') : ''
  return `${sets} × ${range}${unit}${side}`
}
