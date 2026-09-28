import { describe, expect, it } from 'vitest'
import { defaultRange, rangeAfterSwap } from './workoutPlan'

describe('swapping a slot to another exercise', () => {
  it('keeps the range when both count reps', () => {
    expect(rangeAfterSwap({ repMin: 6, repMax: 8 }, 'compound', 'isolation')).toEqual({ repMin: 6, repMax: 8 })
    expect(rangeAfterSwap({ repMin: 40, repMax: 60 }, 'timed', 'timed')).toEqual({ repMin: 40, repMax: 60 })
  })

  it('uses the new type\'s default when reps become seconds or minutes', () => {
    expect(rangeAfterSwap({ repMin: 6, repMax: 8 }, 'compound', 'timed')).toEqual({ repMin: 30, repMax: 45 })
    expect(rangeAfterSwap({ repMin: 30, repMax: 45 }, 'timed', 'isolation')).toEqual({ repMin: 10, repMax: 12 })
    expect(rangeAfterSwap({ repMin: 10, repMax: 12 }, 'isolation', 'cardio')).toEqual({ repMin: 10, repMax: 10 })
  })

  it('keeps the range when nothing was swapped', () => {
    expect(rangeAfterSwap({ repMin: 6, repMax: 8 }, undefined, 'timed')).toEqual({ repMin: 6, repMax: 8 })
  })

  it('has a default for every exercise type', () => {
    expect(defaultRange('compound')).toEqual({ sets: 3, repMin: 8, repMax: 10 })
    expect(defaultRange('cardio').sets).toBe(1)
  })
})
