import { describe, expect, it } from 'vitest'
import { epley, effectiveLoad } from './e1rm'
import { movingAverage } from './movingAverage'
import { roundDownTo, rirVerdict, suggest, type PastSession, type ProgressionInput } from './progression'

const barbell = { type: 'compound', incrementLb: 5, perSide: false, loading: 'external' } as const
const cable = { type: 'isolation', incrementLb: 2.5, perSide: false, loading: 'external' } as const
const base = { min: 2, max: 3 }
const push = { min: 1, max: 2 }

function session(weight: number, reps: number[], rir = 2, targetRir = base, date = '2026-09-28'): PastSession {
  return { date, targetRir, sets: reps.map((r) => ({ weightLb: weight, reps: r, rir })) }
}

function input(over: Partial<ProgressionInput>): ProgressionInput {
  return { exercise: barbell, repMin: 8, repMax: 10, sets: 3, phase: 'base', todayRir: base, history: [], ...over }
}

describe('double progression', () => {
  it('asks for a starting weight when there is no history', () => {
    const s = suggest(input({}))
    expect(s.kind).toBe('first-time')
    expect(s.sets).toEqual([
      { weightLb: null, reps: 8 },
      { weightLb: null, reps: 8 },
      { weightLb: null, reps: 8 },
    ])
    expect(s.reason).toContain('8 reps')
  })

  it('adds the increment and resets reps when every set hit the top', () => {
    const s = suggest(input({ history: [session(60, [10, 10, 10])] }))
    expect(s.kind).toBe('increase')
    expect(s.sets.every((x) => x.weightLb === 65 && x.reps === 8)).toBe(true)
    expect(s.reason).toBe('Hit 10/10/10 last time, so try 65 lb for 8 reps.')
  })

  it('uses the per-exercise increment (2.5 lb cable)', () => {
    const s = suggest(input({ exercise: cable, repMin: 12, repMax: 15, history: [session(30, [15, 15, 15])] }))
    expect(s.sets[0]).toEqual({ weightLb: 32.5, reps: 12 })
  })

  it('adds a rep only on sets under the top of the range', () => {
    const s = suggest(input({ history: [session(60, [10, 9, 8])] }))
    expect(s.kind).toBe('add-reps')
    expect(s.sets.map((x) => x.reps)).toEqual([10, 10, 9])
    expect(s.sets.every((x) => x.weightLb === 60)).toBe(true)
  })

  it('extends to more sets today than last time by repeating the last set', () => {
    const s = suggest(input({ sets: 4, history: [session(60, [10, 9, 8])] }))
    expect(s.sets.map((x) => x.reps)).toEqual([10, 10, 9, 9])
  })

  it('trims to fewer sets today', () => {
    const s = suggest(input({ sets: 2, history: [session(60, [9, 9, 9])] }))
    expect(s.sets).toHaveLength(2)
  })

  it('flags a single session below the range but keeps the weight', () => {
    const s = suggest(input({ history: [session(60, [8, 7, 6])] }))
    expect(s.kind).toBe('add-reps')
    expect(s.flag).toBe('below-range')
    expect(s.sets.map((x) => x.reps)).toEqual([9, 8, 7])
  })

  it('reduces 5-10% after missing the bottom two sessions running', () => {
    const s = suggest(input({ history: [session(100, [8, 7, 6]), session(100, [7, 7, 6], 2, base, '2026-09-24')] }))
    expect(s.kind).toBe('reduce')
    expect(s.flag).toBe('missed-bottom-twice')
    const w = s.sets[0]?.weightLb ?? 0
    expect(w).toBeGreaterThanOrEqual(90)
    expect(w).toBeLessThanOrEqual(95)
    expect(w % 5).toBe(0)
    expect(s.sets[0]?.reps).toBe(8)
  })

  it('always reduces by at least one increment', () => {
    const s = suggest(input({ exercise: cable, history: [session(20, [6, 6, 6]), session(20, [6, 6, 6])] }))
    expect(s.sets[0]?.weightLb).toBe(17.5)
  })

  it('does not reduce if the earlier miss was at a heavier weight (already dropped)', () => {
    const s = suggest(input({ history: [session(90, [7, 8, 8]), session(100, [6, 6, 6])] }))
    expect(s.kind).toBe('add-reps')
  })
})

describe('RIR adjustments', () => {
  it('classifies RIR against the target', () => {
    expect(rirVerdict(4, push)).toBe('much-higher')
    expect(rirVerdict(3, push)).toBe('on-target')
    expect(rirVerdict(0, base)).toBe('much-lower')
    expect(rirVerdict(0, push)).toBe('on-target')
  })

  it('jumps by two increments when the top was hit far too easily', () => {
    const s = suggest(input({ phase: 'push', todayRir: push, history: [session(60, [10, 10, 10], 4, push)] }))
    expect(s.kind).toBe('big-increase')
    expect(s.sets[0]?.weightLb).toBe(70)
  })

  it('adds weight (not just a rep) when well short of the top but very easy', () => {
    const s = suggest(input({ phase: 'push', todayRir: push, history: [session(60, [9, 9, 9], 4, push)] }))
    expect(s.kind).toBe('big-increase')
    expect(s.sets[0]).toEqual({ weightLb: 65, reps: 9 })
  })

  it('holds the weight when the top was hit at 0 RIR early in the block', () => {
    const s = suggest(input({ history: [session(60, [10, 10, 10], 0, base)] }))
    expect(s.kind).toBe('hold')
    expect(s.flag).toBe('rir-too-low')
    expect(s.sets[0]).toEqual({ weightLb: 60, reps: 10 })
  })

  it('holds reps too when grinding below the top', () => {
    const s = suggest(input({ history: [session(60, [9, 8, 8], 0, base)] }))
    expect(s.kind).toBe('hold')
    expect(s.sets.map((x) => x.reps)).toEqual([9, 8, 8])
  })
})

describe('deload', () => {
  it('keeps the same weight', () => {
    const s = suggest(input({ phase: 'deload', todayRir: { min: 4, max: 4 }, sets: 2, history: [session(100, [10, 10, 10])] }))
    expect(s.kind).toBe('deload')
    expect(s.sets).toEqual([
      { weightLb: 100, reps: 8 },
      { weightLb: 100, reps: 8 },
    ])
  })
})

describe('per-side exercises', () => {
  it('progresses on the weaker side (reps already stored as the minimum)', () => {
    const lunge = { type: 'compound', incrementLb: 5, perSide: true, loading: 'external' } as const
    const s = suggest(input({ exercise: lunge, repMin: 10, repMax: 10, history: [session(40, [10, 10, 9])] }))
    expect(s.kind).toBe('add-reps')
    expect(s.sets.map((x) => x.reps)).toEqual([10, 10, 10])
    const up = suggest(input({ exercise: lunge, repMin: 10, repMax: 10, history: [session(40, [10, 10, 10])] }))
    expect(up.sets[0]).toEqual({ weightLb: 45, reps: 10 })
  })
})

describe('timed exercises', () => {
  const plank = { type: 'timed', incrementLb: 10, perSide: false, loading: 'timed', timedProgression: 'add-weight' } as const
  const timedSession = (secs: number[], weight = 0): PastSession => ({
    date: '2026-09-24',
    targetRir: base,
    sets: secs.map((d) => ({ weightLb: weight, reps: 0, rir: 2, durationSec: d })),
  })

  it('adds 5 seconds per set, capped at the top', () => {
    const s = suggest(input({ exercise: plank, repMin: 45, repMax: 60, history: [timedSession([45, 50, 58])] }))
    expect(s.kind).toBe('timed-add-seconds')
    expect(s.sets.map((x) => x.reps)).toEqual([50, 55, 60])
  })

  it('adds weight at the top when configured', () => {
    const s = suggest(input({ exercise: plank, repMin: 45, repMax: 60, history: [timedSession([60, 60, 60])] }))
    expect(s.kind).toBe('timed-add-weight')
    expect(s.sets[0]).toEqual({ weightLb: 10, reps: 45 })
  })

  it('suggests a harder variation at the top when configured', () => {
    const s = suggest(input({ exercise: { ...plank, timedProgression: 'harder-variation' }, repMin: 45, repMax: 60, history: [timedSession([60, 61, 60])] }))
    expect(s.kind).toBe('timed-harder-variation')
  })

  it('starts at the bottom of the range with no history', () => {
    const s = suggest(input({ exercise: plank, repMin: 45, repMax: 60 }))
    expect(s.sets[0]).toEqual({ weightLb: 0, reps: 45 })
    expect(s.reason).toContain('45s')
  })
})

describe('bodyweight exercises with no increment', () => {
  it('never asks for a weight the first time (ab wheel)', () => {
    const wheel = { type: 'isolation', incrementLb: 0, perSide: false, loading: 'bodyweight-plus' } as const
    const s = suggest(input({ exercise: wheel, repMin: 8, repMax: 12 }))
    expect(s.sets[0]).toEqual({ weightLb: 0, reps: 8 })
    expect(s.reason).toContain('bodyweight only')
    expect(s.reason).not.toContain('pick a weight')
  })

  it('starts weighted pull-ups at bodyweight (0 added)', () => {
    const pullup = { type: 'compound', incrementLb: 2.5, perSide: false, loading: 'bodyweight-plus' } as const
    const s = suggest(input({ exercise: pullup, repMin: 6, repMax: 8 }))
    expect(s.sets[0]).toEqual({ weightLb: 0, reps: 6 })
    expect(s.reason).toContain('0 added')
  })

  it('suggests adding load or a harder variation at the top', () => {
    const hlr = { type: 'isolation', incrementLb: 0, perSide: false, loading: 'bodyweight-plus' } as const
    const s = suggest(input({ exercise: hlr, repMin: 10, repMax: 12, history: [session(0, [12, 12, 12])] }))
    expect(s.kind).toBe('top-no-increment')
    expect(s.sets[0]).toEqual({ weightLb: 0, reps: 12 })
  })
})

describe('helpers', () => {
  it('rounds down to the increment', () => {
    expect(roundDownTo(92.5, 5)).toBe(90)
    expect(roundDownTo(18.5, 2.5)).toBe(17.5)
    expect(roundDownTo(50, 0)).toBe(50)
  })

  it('computes Epley e1RM', () => {
    expect(epley(100, 1)).toBe(100)
    expect(epley(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley(100, 0)).toBe(0)
    expect(effectiveLoad(25, true, 195)).toBe(220)
    expect(effectiveLoad(25, false, 195)).toBe(25)
  })

  it('computes a trailing 7-day moving average that ignores missing days', () => {
    const avg = movingAverage([
      { date: '2026-09-24', value: 196 },
      { date: '2026-09-25', value: 194 },
      { date: '2026-10-02', value: 190 },
    ])
    expect(avg.map((p) => p.value)).toEqual([196, 195, 190])
  })
})
