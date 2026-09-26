import type { Goal, Pace, Profile, Settings } from '../types'
import { lbToKg } from './units'

export type Targets = Pick<Settings, 'calorieTarget' | 'proteinTargetG' | 'stepGoal' | 'lossRateMinLb' | 'lossRateMaxLb' | 'satFatLimitG' | 'fiberTargetG' | 'goal'>

const round = (n: number, step: number) => Math.round(n / step) * step
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Resting energy (Mifflin-St Jeor). "Unspecified" uses the midpoint of the two formulas. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightIn' | 'weightLb'>): number {
  const kg = lbToKg(p.weightLb)
  const cm = p.heightIn * 2.54
  const base = 10 * kg + 6.25 * cm - 5 * p.age
  return base + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78)
}

/** Daily energy use: resting x an activity factor from training days (assumes a moderately active day otherwise). */
export function maintenance(p: Pick<Profile, 'sex' | 'age' | 'heightIn' | 'weightLb' | 'daysPerWeek'>): number {
  const factor = p.daysPerWeek <= 1 ? 1.3 : p.daysPerWeek <= 3 ? 1.4 : p.daysPerWeek <= 4 ? 1.47 : 1.55
  return bmr(p) * factor
}

/** Calorie change from maintenance for a goal and pace. */
export function calorieDelta(goal: Goal, pace: Pace): number {
  const table: Record<Goal, Record<Pace, number>> = {
    'lose-fat': { gentle: -300, steady: -450, aggressive: -650 },
    recomp: { gentle: -150, steady: -250, aggressive: -350 },
    'build-muscle': { gentle: 150, steady: 250, aggressive: 400 },
    strength: { gentle: 100, steady: 200, aggressive: 300 },
    health: { gentle: -150, steady: -250, aggressive: -400 },
  }
  return table[goal][pace]
}

/** Heart-health cue in free-text notes (high cholesterol, blood pressure...). */
export function heartHealthy(notes: string): boolean {
  return /cholesterol|ldl|lipid|triglycer|heart|cardio|blood pressure|hypertension|statin/i.test(notes)
}

/**
 * Starting targets from a profile. Everything stays editable in Settings, and
 * the weekly review adjusts calories from real weigh-ins after that.
 */
export function targetsFor(p: Profile): Targets {
  const tdee = maintenance(p)
  const floor = p.sex === 'female' ? 1200 : p.sex === 'male' ? 1500 : 1350
  const calories = clamp(round(tdee + calorieDelta(p.goal, p.pace), 25), Math.max(floor, round(bmr(p), 25)), 6000)
  const losing = p.goal === 'lose-fat' || p.goal === 'recomp' || p.goal === 'health'
  // Protein per lb: higher while dieting; for very heavy people use ~a healthier reference weight.
  const refWeight = Math.min(p.weightLb, (p.heightIn * p.heightIn * 27) / 703)
  const perLb = p.goal === 'health' ? 0.7 : losing ? 0.9 : 0.8
  const protein = clamp(round(refWeight * perLb, 5), 60, 260)
  // Weekly loss range as % of bodyweight.
  const pct: Record<Pace, [number, number]> = { gentle: [0.2, 0.4], steady: [0.3, 0.6], aggressive: [0.5, 1.0] }
  const [lo, hi] = p.goal === 'recomp' || p.goal === 'health' ? [0.1, 0.4] : pct[p.pace]
  const heart = heartHealthy(p.healthNotes)
  return {
    calorieTarget: calories,
    proteinTargetG: protein,
    stepGoal: p.goal === 'lose-fat' ? 9000 : 8000,
    lossRateMinLb: Math.round(((p.weightLb * lo) / 100) * 4) / 4,
    lossRateMaxLb: Math.max(0.25, Math.round(((p.weightLb * hi) / 100) * 4) / 4),
    satFatLimitG: Math.round((calories * (heart ? 0.06 : 0.1)) / 9),
    fiberTargetG: Math.round((calories / 1000) * 14),
    goal: losing ? 'cut' : 'surplus',
  }
}
