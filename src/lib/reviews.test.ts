import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY, exerciseMap } from '../data/exercises'
import { DEFAULT_SCHEDULE, weekDefinition } from '../data/program'
import type { SetLog, WorkoutLog } from '../types'
import { addDays } from './dates'
import { setsPerMuscle, weekAdherence } from './stats'
import { progressStatus, type StatusInput } from './status'
import { detectStrengthDrop, weeklyLiftSeries } from './strength'
import { estimateMaintenance, weeklyReview, type WeighIn } from './weeklyReview'

const END = '2026-10-25' // a Sunday

/** Daily weigh-ins for `days` days ending at END, at a steady rate per week. */
function steady(startWeight: number, lossPerWeek: number, days = 21, skip: number[] = []): WeighIn[] {
  const out: WeighIn[] = []
  for (let i = 0; i < days; i++) {
    if (skip.includes(i)) continue
    const daysBeforeEnd = days - 1 - i
    out.push({ date: addDays(END, -daysBeforeEnd), weightLb: startWeight - (lossPerWeek / 7) * i })
  }
  return out
}

const cut = { endDate: END, lossRateMinLb: 0.5, lossRateMaxLb: 1, goal: 'cut' as const }

describe('weeklyReview', () => {
  it('needs 5 weigh-ins in both weeks', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, 0.75, 14, [8, 9, 10]) })
    expect(r.kind).toBe('insufficient-data')
    expect(r.weighInCount).toBe(4)
    expect(r.recommendation).toContain('this week 4/5')
  })

  it('accepts exactly 5 weigh-ins', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, 0.75, 14, [7, 8]) })
    expect(r.kind).not.toBe('insufficient-data')
  })

  it('is on track between 0.5 and 1 lb/week', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, 0.75) })
    expect(r.kind).toBe('on-track')
    expect(r.deltaLb).toBeCloseTo(-0.75, 5)
    expect(r.calorieRange).toBeUndefined()
  })

  it('suggests +100 to +150 kcal when losing more than 1 lb/week', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, 1.5) })
    expect(r.kind).toBe('losing-fast')
    expect(r.calorieRange).toEqual({ min: 100, max: 150 })
  })

  it('offers calories or steps when under 0.5 lb over two weeks', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, 0.2) })
    expect(r.kind).toBe('too-slow')
    expect(r.calorieRange).toEqual({ min: -150, max: -100 })
    expect(r.stepDelta).toBe(2000)
  })

  it('waits for a second week before calling it slow', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, 0.2, 14) })
    expect(r.kind).toBe('watch')
    expect(r.calorieRange).toBeUndefined()
  })

  it('does not act on one slow week when two weeks are fine', () => {
    const w = [...steady(196, 1, 21).slice(0, 14), ...steady(194.4, 0.3, 7)]
    const r = weeklyReview({ ...cut, weighIns: w })
    expect(r.kind).toBe('watch')
  })

  it('flags gaining and applies the slow-loss options', () => {
    const r = weeklyReview({ ...cut, weighIns: steady(195, -0.5) })
    expect(r.kind).toBe('gaining')
    expect(r.flag).toBe('gaining')
    expect(r.stepDelta).toBe(2000)
  })

  it('averages several weigh-ins on the same day as one', () => {
    const w = steady(195, 0.75, 14)
    const r1 = weeklyReview({ ...cut, weighIns: w })
    const r2 = weeklyReview({ ...cut, weighIns: [...w, { date: END, weightLb: w[w.length - 1]!.weightLb }] })
    expect(r2.weighInCount).toBe(r1.weighInCount)
    expect(r2.avgWeightLb).toBeCloseTo(r1.avgWeightLb!, 5)
  })

  it('handles a surplus goal', () => {
    const s = { ...cut, goal: 'surplus' as const }
    expect(weeklyReview({ ...s, weighIns: steady(195, -0.3) }).kind).toBe('on-track')
    expect(weeklyReview({ ...s, weighIns: steady(195, -1) }).kind).toBe('surplus-too-fast')
    expect(weeklyReview({ ...s, weighIns: steady(195, 0.5) }).kind).toBe('surplus-losing')
  })
})

describe('estimateMaintenance', () => {
  it('adds the deficit implied by the weight trend to intake', () => {
    const intake = Array.from({ length: 14 }, (_, i) => ({ date: addDays(END, -i), calories: 2450 }))
    const m = estimateMaintenance({ intake, weighIns: steady(195, 1, 14), endDate: END })
    // 1 lb/week = 500 kcal/day
    expect(m?.kcal).toBe(2950)
  })

  it('needs 7 days of intake', () => {
    const intake = Array.from({ length: 6 }, (_, i) => ({ date: addDays(END, -i), calories: 2450 }))
    expect(estimateMaintenance({ intake, weighIns: steady(195, 1, 14), endDate: END })).toBeUndefined()
  })
})

const lib = exerciseMap(EXERCISE_LIBRARY)
const squat = lib.get('back-squat')!
const set = (weightLb: number, reps: number, p: Partial<SetLog> = {}): SetLog => ({ slotId: 'lh-1', exerciseId: 'back-squat', setIndex: 0, weightLb, reps, rir: 2, isWarmup: false, loggedAt: 0, ...p })
const wk = (weekNumber: number, sets: SetLog[], date = addDays('2026-09-28', (weekNumber - 1) * 7 + 1)): WorkoutLog => ({
  id: `w${weekNumber}-${date}`,
  date,
  weekNumber,
  sessionTemplateId: 'lower-heavy',
  startedAt: 0,
  finishedAt: 1,
  notes: '',
  sets,
})

describe('strength', () => {
  it('builds a weekly series and skips the deload week', () => {
    const s = weeklyLiftSeries([wk(8, [set(200, 6)]), wk(9, [set(200, 3)]), wk(10, [set(205, 6), set(185, 8)])], squat)
    expect(s.map((p) => p.week)).toEqual([8, 10])
    expect(s[1]?.topWeightLb).toBe(205)
  })

  it('flags two consecutive weekly drops, not one', () => {
    const one = weeklyLiftSeries([wk(3, [set(200, 6)]), wk(4, [set(200, 6)]), wk(5, [set(195, 6)])], squat)
    expect(detectStrengthDrop('back-squat', one)).toBeUndefined()
    const two = weeklyLiftSeries([wk(3, [set(200, 6)]), wk(4, [set(195, 6)]), wk(5, [set(190, 6)])], squat)
    const d = detectStrengthDrop('back-squat', two)
    expect(d?.weeks).toBe(2)
    expect(d?.metric).toBe('both')
    expect(d?.percent).toBeCloseTo(5, 5)
  })

  it('treats fewer reps at the same weight as an e1RM drop', () => {
    const s = weeklyLiftSeries([wk(3, [set(200, 8)]), wk(4, [set(200, 7)]), wk(5, [set(200, 6)])], squat)
    expect(detectStrengthDrop('back-squat', s)?.metric).toBe('e1rm')
  })
})

describe('stats', () => {
  it('counts primary sets fully and secondary as half, skipping warm-ups', () => {
    const w = wk(1, [set(200, 6), set(200, 6), set(95, 8, { isWarmup: true }), set(60, 10, { exerciseId: 'incline-barbell-press' })])
    const m = setsPerMuscle([w], lib)
    expect(m.quads).toBe(2)
    expect(m.glutes).toBe(2)
    expect(m.core).toBe(1)
    expect(m.chest).toBe(1)
    expect(m.triceps).toBe(0.5)
  })

  it('counts adherence only up to today', () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays('2026-09-28', i))
    const a = weekAdherence({
      week: 1,
      dates,
      today: '2026-09-30', // Wed: Mon + Tue sessions so far
      schedule: DEFAULT_SCHEDULE,
      workouts: [wk(1, [set(200, 6)], '2026-09-29')],
      dailyLogs: [
        { date: '2026-09-28', steps: 9500 },
        { date: '2026-09-29', steps: 6000 },
        { date: '2026-10-02', steps: 12000 },
      ],
      stepGoal: 9000,
    })
    expect(a).toMatchObject({ planned: 2, completed: 1, stepDays: 2, stepHits: 1 })
  })
})

describe('progressStatus', () => {
  const base: StatusInput = { strengthDrops: [], liftsTracked: 0, fatigueCount: 0, lossRateMinLb: 0.5, lossRateMaxLb: 1 }

  it('is unknown with no data', () => {
    expect(progressStatus(base).level).toBe('unknown')
  })

  it('is green for slow loss, waist down, strength stable', () => {
    const s = progressStatus({ ...base, weeklyLossLb: 0.7, waistChangeIn: -0.5, liftsTracked: 4 })
    expect(s.level).toBe('green')
    expect(s.good).toHaveLength(3)
  })

  it('is red for fast loss, constant fatigue or big strength drops', () => {
    expect(progressStatus({ ...base, weeklyLossLb: 2 }).level).toBe('red')
    expect(progressStatus({ ...base, avgFatigue: 4.2, fatigueCount: 5 }).level).toBe('red')
    expect(progressStatus({ ...base, liftsTracked: 4, strengthDrops: [{ name: 'Squat', percent: 6 }] }).level).toBe('red')
  })

  it('is yellow for milder signs', () => {
    expect(progressStatus({ ...base, liftsTracked: 4, strengthDrops: [{ name: 'Squat', percent: 2 }] }).level).toBe('yellow')
    expect(progressStatus({ ...base, weeklyLossLb: 0.2 }).level).toBe('yellow')
    expect(progressStatus({ ...base, weeklyLossLb: 1.2 }).level).toBe('yellow')
  })

  it('ignores fatigue from fewer than 3 check-ins', () => {
    expect(progressStatus({ ...base, avgFatigue: 5, fatigueCount: 2 }).level).toBe('unknown')
  })
})

describe('extension weeks', () => {
  it('deloads every 5th week after week 12', () => {
    expect(weekDefinition(13).phase).toBe('extension')
    expect(weekDefinition(16).phase).toBe('extension')
    expect(weekDefinition(17).phase).toBe('deload')
    expect(weekDefinition(18).phase).toBe('extension')
    expect(weekDefinition(22).phase).toBe('deload')
  })
})
