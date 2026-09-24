import { describe, expect, it } from 'vitest'
import type { SetLog, WorkoutLog } from '../types'
import { countedReps, exerciseHistory, findPRs, workoutVolume } from './history'

const set = (p: Partial<SetLog>): SetLog => ({
  slotId: 's',
  exerciseId: 'back-squat',
  setIndex: 0,
  weightLb: 100,
  reps: 5,
  rir: 2,
  isWarmup: false,
  loggedAt: 0,
  ...p,
})

const workout = (id: string, date: string, sets: SetLog[], finished = true, weekNumber = 1): WorkoutLog => ({
  id,
  date,
  weekNumber,
  sessionTemplateId: 'lower-heavy',
  startedAt: Date.parse(date),
  ...(finished ? { finishedAt: Date.parse(date) + 3600_000 } : {}),
  notes: '',
  sets,
})

const ex = new Map([
  ['back-squat', { type: 'compound' as const, loading: 'external' as const }],
  ['weighted-pull-up', { type: 'compound' as const, loading: 'bodyweight-plus' as const }],
  ['plank', { type: 'timed' as const, loading: 'timed' as const }],
  ['walking-lunge', { type: 'compound' as const, loading: 'external' as const }],
])

describe('exerciseHistory', () => {
  it('returns finished sessions most recent first, working sets only, in set order', () => {
    const h = exerciseHistory(
      [
        workout('a', '2026-09-29', [set({ setIndex: 1, reps: 6 }), set({ setIndex: 0, reps: 7 }), set({ isWarmup: true, weightLb: 45 })]),
        workout('b', '2026-10-06', [set({ weightLb: 105 })]),
        workout('c', '2026-10-13', [set({ weightLb: 110 })], false),
      ],
      'back-squat',
    )
    expect(h.map((s) => s.date)).toEqual(['2026-10-06', '2026-09-29'])
    expect(h[1]?.sets.map((s) => s.reps)).toEqual([7, 6])
    expect(h[1]?.sets).toHaveLength(2)
  })

  it('uses the weaker side for per-side sets', () => {
    expect(countedReps({ reps: 10, repsLeft: 10, repsRight: 9 })).toBe(9)
    const h = exerciseHistory([workout('a', '2026-09-29', [set({ exerciseId: 'walking-lunge', reps: 9, repsLeft: 10, repsRight: 9 })])], 'walking-lunge')
    expect(h[0]?.sets[0]?.reps).toBe(9)
  })

  it('skips the workout in progress', () => {
    expect(exerciseHistory([workout('a', '2026-09-29', [set({})])], 'back-squat', 'a')).toEqual([])
  })

  it('records the target RIR of the week the session was in', () => {
    const h = exerciseHistory([workout('a', '2026-11-02', [set({})], true, 6)], 'back-squat')
    expect(h[0]?.targetRir).toEqual({ min: 1, max: 2 })
  })
})

describe('workoutVolume', () => {
  it('ignores warm-ups and timed sets and counts both sides', () => {
    const v = workoutVolume(
      [
        set({ weightLb: 100, reps: 5 }),
        set({ weightLb: 45, reps: 10, isWarmup: true }),
        set({ exerciseId: 'plank', weightLb: 0, reps: 0, durationSec: 60 }),
        set({ exerciseId: 'walking-lunge', weightLb: 40, reps: 9, repsLeft: 10, repsRight: 9 }),
      ],
      ex,
    )
    expect(v).toBe(500 + 40 * 19)
  })
})

describe('findPRs', () => {
  it('reports e1RM and weight records against earlier sessions only', () => {
    const earlier = [workout('a', '2026-09-29', [set({ weightLb: 100, reps: 5 })])]
    const now = workout('b', '2026-10-06', [set({ weightLb: 105, reps: 5 })])
    const prs = findPRs(now, earlier, ex)
    expect(prs.map((p) => p.kind).sort()).toEqual(['e1rm', 'weight'])
  })

  it('sets no record on the first ever session of an exercise', () => {
    expect(findPRs(workout('b', '2026-10-06', [set({})]), [], ex)).toEqual([])
  })

  it('counts more reps at the same weight as an e1RM record only', () => {
    const prs = findPRs(workout('b', '2026-10-06', [set({ reps: 7 })]), [workout('a', '2026-09-29', [set({ reps: 5 })])], ex)
    expect(prs.map((p) => p.kind)).toEqual(['e1rm'])
  })

  it('includes bodyweight in pull-up e1RM', () => {
    const prs = findPRs(
      workout('b', '2026-10-06', [set({ exerciseId: 'weighted-pull-up', weightLb: 10, reps: 6 })]),
      [workout('a', '2026-09-29', [set({ exerciseId: 'weighted-pull-up', weightLb: 5, reps: 6 })])],
      ex,
      195,
    )
    const e = prs.find((p) => p.kind === 'e1rm')
    expect(e?.value).toBeCloseTo(205 * 1.2, 5)
  })
})
