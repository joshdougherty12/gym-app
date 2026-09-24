import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY, exerciseMap } from '../data/exercises'
import { SESSION_TEMPLATES, weekDefinition } from '../data/program'
import type { ExerciseSlot } from '../types'
import { deloadSets, formatSlotTarget, plannedSets, targetRirForSet } from './weekPlan'

const lib = exerciseMap(EXERCISE_LIBRARY)
const get = (id: string) => {
  const e = lib.get(id)
  if (!e) throw new Error(id)
  return e
}
const slot = (exerciseId: string, sets: number, isMainLift = false): ExerciseSlot => ({
  slotId: `s-${exerciseId}`,
  exerciseId,
  sets,
  repMin: 8,
  repMax: 10,
  isMainLift,
})

describe('deloadSets', () => {
  it('cuts about 40% and never drops below 1', () => {
    expect(deloadSets(4)).toBe(2)
    expect(deloadSets(3)).toBe(2)
    expect(deloadSets(2)).toBe(1)
    expect(deloadSets(1)).toBe(1)
    expect(deloadSets(5)).toBe(3)
    expect(deloadSets(0)).toBe(0)
  })

  it('cuts every template session by 30-50% in total', () => {
    const w9 = weekDefinition(9)
    for (const s of SESSION_TEMPLATES) {
      const lifting = s.slots.filter((x) => get(x.exerciseId).type !== 'cardio')
      const before = lifting.reduce((n, x) => n + x.sets, 0)
      const after = lifting.reduce((n, x) => n + plannedSets(x, get(x.exerciseId), w9).sets, 0)
      const cut = 1 - after / before
      expect(cut, s.name).toBeGreaterThanOrEqual(0.3)
      expect(cut, s.name).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('plannedSets', () => {
  it('adds a set to lateral raises and rear delts in weeks 5-8 only', () => {
    const lat = slot('cable-lateral-raise', 4)
    expect(plannedSets(lat, get('cable-lateral-raise'), weekDefinition(3)).sets).toBe(4)
    expect(plannedSets(lat, get('cable-lateral-raise'), weekDefinition(5)).sets).toBe(5)
    expect(plannedSets(slot('face-pull', 4), get('face-pull'), weekDefinition(8)).sets).toBe(5)
    expect(plannedSets(slot('flat-db-press', 3), get('flat-db-press'), weekDefinition(6)).sets).toBe(3)
  })

  it('adds a set to the chosen weakest lift in the push phase', () => {
    const s = slot('back-squat', 4, true)
    const o = { weekNumber: 6, extraSets: {}, weakestLiftSlotId: s.slotId }
    expect(plannedSets(s, get('back-squat'), weekDefinition(6), o).sets).toBe(5)
    // Not applied in the base phase.
    expect(plannedSets(s, get('back-squat'), weekDefinition(2), { ...o, weekNumber: 2 }).sets).toBe(4)
  })

  it('applies the shoulders/core bonus only in weeks 0-4', () => {
    const o = { weekNumber: 2, extraSets: {}, shouldersCoreBonus: true }
    expect(plannedSets(slot('seated-db-ohp', 3), get('seated-db-ohp'), weekDefinition(2), o).sets).toBe(4)
    expect(plannedSets(slot('cable-crunch', 3), get('cable-crunch'), weekDefinition(2), o).sets).toBe(4)
    expect(plannedSets(slot('back-squat', 4), get('back-squat'), weekDefinition(2), o).sets).toBe(4)
    expect(plannedSets(slot('seated-db-ohp', 3), get('seated-db-ohp'), weekDefinition(6), o).sets).toBe(3)
  })

  it('ignores bonuses in the deload week', () => {
    const s = slot('cable-lateral-raise', 4)
    const o = { weekNumber: 9, extraSets: { [s.slotId]: 2 }, weakestLiftSlotId: s.slotId }
    expect(plannedSets(s, get('cable-lateral-raise'), weekDefinition(9), o).sets).toBe(2)
  })

  it('applies manual set edits but never goes below 1', () => {
    const s = slot('hammer-curl', 2)
    expect(plannedSets(s, get('hammer-curl'), weekDefinition(1), { weekNumber: 1, extraSets: { [s.slotId]: 1 } }).sets).toBe(3)
    expect(plannedSets(s, get('hammer-curl'), weekDefinition(1), { weekNumber: 1, extraSets: { [s.slotId]: -5 } }).sets).toBe(1)
  })

  it('leaves cardio alone', () => {
    const s = { ...slot('bike-intervals', 1), repMin: 10, repMax: 10 }
    expect(plannedSets(s, get('bike-intervals'), weekDefinition(9)).sets).toBe(1)
  })
})

describe('targetRirForSet', () => {
  it('sends only the last set of a main lift to 0-1 RIR in peak weeks', () => {
    const w = weekDefinition(11)
    const main = slot('back-squat', 4, true)
    expect(targetRirForSet(w, main, 3, 4)).toEqual({ min: 0, max: 1 })
    expect(targetRirForSet(w, main, 2, 4)).toEqual({ min: 1, max: 2 })
    expect(targetRirForSet(w, slot('hammer-curl', 2), 1, 2)).toEqual({ min: 1, max: 2 })
    expect(targetRirForSet(weekDefinition(7), main, 3, 4)).toEqual({ min: 1, max: 2 })
  })
})

describe('formatSlotTarget', () => {
  it('labels timed, per-side and cardio slots', () => {
    expect(formatSlotTarget({ ...slot('plank', 3), repMin: 45, repMax: 60 }, get('plank'))).toBe('3 × 45-60 s')
    expect(formatSlotTarget({ ...slot('walking-lunge', 3), repMin: 10, repMax: 10 }, get('walking-lunge'))).toBe('3 × 10 / leg')
    expect(formatSlotTarget({ ...slot('bike-intervals', 1), repMin: 10, repMax: 10 }, get('bike-intervals'))).toBe('10 min')
  })
})
