import { describe, expect, it } from 'vitest'
import { portionLine, portionSplit } from './portions'

describe('partner portions', () => {
  it('splits two servings by calorie target', () => {
    expect(portionSplit(2400, 1600)).toEqual({ mine: 1.2, theirs: 0.8 })
    expect(portionSplit(2000, 2000)).toEqual({ mine: 1, theirs: 1 })
    expect(portionSplit(2450, 1700)).toEqual({ mine: 1.2, theirs: 0.8 })
  })

  it('stays sensible for extreme or missing targets', () => {
    expect(portionSplit(5000, 500)).toEqual({ mine: 1.8, theirs: 0.25 })
    expect(portionSplit(0, 2000)).toEqual({ mine: 1, theirs: 1 })
    expect(portionSplit(Number.NaN, 2000)).toEqual({ mine: 1, theirs: 1 })
  })

  it('reads as a plain label', () => {
    expect(portionLine('Josh', 'Sam', { mine: 1.2, theirs: 1 })).toBe('Josh 1.2 servings · Sam 1 serving')
  })
})
