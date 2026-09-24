import type { Exercise, ExerciseSlot, Settings } from '../types'

type RestSettings = Pick<Settings, 'restCompoundSec' | 'restIsolationSec' | 'restTimedSec'>

/** Rest after a set: the slot's own value if set, otherwise the default for the exercise type. */
export function restFor(slot: Pick<ExerciseSlot, 'restSec'>, exercise: Pick<Exercise, 'type'>, settings: RestSettings): number {
  if (slot.restSec !== undefined) return slot.restSec
  switch (exercise.type) {
    case 'compound':
      return settings.restCompoundSec
    case 'isolation':
      return settings.restIsolationSec
    case 'timed':
      return settings.restTimedSec
    case 'cardio':
      return 0
  }
}

/** 150 -> "2:30" */
export function formatRest(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
