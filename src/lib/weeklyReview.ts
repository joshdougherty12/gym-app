import type { ReviewKind } from '../types'
import { addDays, daysBetween, type IsoDate } from './dates'

export interface WeighIn {
  date: IsoDate
  weightLb: number
}

export interface ReviewInput {
  weighIns: readonly WeighIn[]
  /** Last day of the week under review (inclusive), usually a Sunday. */
  endDate: IsoDate
  lossRateMinLb: number
  lossRateMaxLb: number
  goal: 'cut' | 'surplus'
  /** Weigh-ins needed in each 7-day window before recommending anything. */
  minWeighIns?: number
}

export interface ReviewResult {
  kind: ReviewKind
  weighInCount: number
  prevWeighInCount: number
  avgWeightLb?: number
  prevAvgWeightLb?: number
  /** avg - prevAvg. Negative = lost weight. */
  deltaLb?: number
  /** avg - avg two weeks earlier, when that week has enough data. */
  twoWeekDeltaLb?: number
  recommendation: string
  /** Calorie change range to offer, e.g. {min: 100, max: 150} or {min: -150, max: -100}. */
  calorieRange?: { min: number; max: number }
  /** Alternative to cutting calories. */
  stepDelta?: number
  flag?: 'gaining'
}

const SURPLUS_MAX_GAIN = 0.5
const STEP_BUMP = 2000

function windowStats(weighIns: readonly WeighIn[], endDate: IsoDate) {
  const start = addDays(endDate, -6)
  const inWindow = weighIns.filter((w) => daysBetween(start, w.date) >= 0 && daysBetween(w.date, endDate) >= 0)
  // One weigh-in per day: if a day has several, use their mean.
  const byDay = new Map<string, number[]>()
  for (const w of inWindow) byDay.set(w.date, [...(byDay.get(w.date) ?? []), w.weightLb])
  const days = [...byDay.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length)
  return { count: days.length, avg: days.length ? days.reduce((a, b) => a + b, 0) / days.length : undefined }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const lb = (n: number) => `${r1(Math.abs(n))} lb`

/**
 * Weekly review: compares the average weight of the last 7 days with the 7
 * before (and the 7 before that, for the two-week rule) and recommends a
 * calorie or step change.
 */
export function weeklyReview(input: ReviewInput): ReviewResult {
  const min = input.minWeighIns ?? 5
  const w0 = windowStats(input.weighIns, input.endDate)
  const w1 = windowStats(input.weighIns, addDays(input.endDate, -7))
  const w2 = windowStats(input.weighIns, addDays(input.endDate, -14))
  const base = { weighInCount: w0.count, prevWeighInCount: w1.count }

  if (w0.count < min || w1.count < min || w0.avg === undefined || w1.avg === undefined) {
    const need = [w0.count < min ? `this week ${w0.count}/${min}` : '', w1.count < min ? `last week ${w1.count}/${min}` : ''].filter(Boolean).join(', ')
    return {
      ...base,
      kind: 'insufficient-data',
      ...(w0.avg !== undefined ? { avgWeightLb: w0.avg } : {}),
      ...(w1.avg !== undefined ? { prevAvgWeightLb: w1.avg } : {}),
      recommendation: `Not enough weigh-ins to judge (${need}). Weigh in at least ${min} mornings a week; no change for now.`,
    }
  }

  const delta = w0.avg - w1.avg
  const twoWeek = w2.count >= min && w2.avg !== undefined ? w0.avg - w2.avg : undefined
  const stats = {
    ...base,
    avgWeightLb: w0.avg,
    prevAvgWeightLb: w1.avg,
    deltaLb: delta,
    ...(twoWeek !== undefined ? { twoWeekDeltaLb: twoWeek } : {}),
  }

  if (input.goal === 'surplus') {
    if (delta > SURPLUS_MAX_GAIN) {
      return { ...stats, kind: 'surplus-too-fast', calorieRange: { min: -150, max: -100 }, recommendation: `Gained ${lb(delta)} this week, faster than the ~0.25-0.5 lb a small surplus should give. Drop 100-150 kcal.` }
    }
    if (delta < 0) {
      return { ...stats, kind: 'surplus-losing', calorieRange: { min: 100, max: 150 }, recommendation: `Still losing (${lb(delta)} this week) on a surplus. Add 100-150 kcal.` }
    }
    return { ...stats, kind: 'on-track', recommendation: `Up ${lb(delta)} this week. On track for a small surplus, no change.` }
  }

  const loss = -delta
  const slowOptions = { calorieRange: { min: -150, max: -100 }, stepDelta: STEP_BUMP }

  if (delta > 0) {
    return {
      ...stats,
      ...slowOptions,
      kind: 'gaining',
      flag: 'gaining',
      recommendation: `Weight went up ${lb(delta)} this week. Cut 100-150 kcal a day, or add ${STEP_BUMP.toLocaleString()} steps a day. Your choice.`,
    }
  }
  if (loss > input.lossRateMaxLb) {
    return {
      ...stats,
      kind: 'losing-fast',
      calorieRange: { min: 100, max: 150 },
      recommendation: `Lost ${lb(loss)} this week, faster than ${input.lossRateMaxLb} lb/week. Add 100-150 kcal a day to protect strength.`,
    }
  }
  if (loss >= input.lossRateMinLb) {
    return { ...stats, kind: 'on-track', recommendation: `Lost ${lb(loss)} this week. On track, no change.` }
  }
  // Under the minimum this week: act only if two weeks show under the minimum too.
  if (twoWeek === undefined) {
    return {
      ...stats,
      kind: 'watch',
      recommendation: `Lost ${lb(loss)} this week, under ${input.lossRateMinLb} lb. One more week of data before changing anything.`,
    }
  }
  if (-twoWeek < input.lossRateMinLb) {
    return {
      ...stats,
      ...slowOptions,
      kind: 'too-slow',
      recommendation: `Only ${lb(-twoWeek)} lost over two weeks. Cut 100-150 kcal a day, or add ${STEP_BUMP.toLocaleString()} steps a day. Your choice.`,
    }
  }
  return {
    ...stats,
    kind: 'watch',
    recommendation: `Slower week (${lb(loss)}), but ${lb(-twoWeek)} over two weeks is fine. No change yet.`,
  }
}

/**
 * Maintenance estimate from recent intake and weight trend:
 * average intake + (lb lost per day x 3,500 kcal). Needs at least 7 days of
 * logged calories and enough weigh-ins for two weekly averages.
 */
export function estimateMaintenance(args: {
  intake: readonly { date: IsoDate; calories: number }[]
  weighIns: readonly WeighIn[]
  endDate: IsoDate
}): { kcal: number; basis: string } | undefined {
  const start = addDays(args.endDate, -13)
  const days = args.intake.filter((d) => daysBetween(start, d.date) >= 0 && daysBetween(d.date, args.endDate) >= 0)
  if (days.length < 7) return undefined
  const w0 = windowStats(args.weighIns, args.endDate)
  const w1 = windowStats(args.weighIns, addDays(args.endDate, -7))
  if (w0.avg === undefined || w1.avg === undefined || w0.count < 4 || w1.count < 4) return undefined
  const avgIntake = days.reduce((s, d) => s + d.calories, 0) / days.length
  const lossPerDay = (w1.avg - w0.avg) / 7
  const kcal = Math.round((avgIntake + lossPerDay * 3500) / 25) * 25
  return { kcal, basis: `${Math.round(avgIntake)} kcal/day average intake over ${days.length} days, weight trend ${lossPerDay >= 0 ? '−' : '+'}${r1(Math.abs(lossPerDay * 7))} lb/week` }
}
