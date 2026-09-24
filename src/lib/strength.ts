import { weekDefinition } from '../data/program'
import type { Exercise, WorkoutLog } from '../types'
import { effectiveLoad, epley } from './e1rm'
import { countedReps } from './history'

export interface LiftPoint {
  week: number
  /** First date trained that week, for chart labels. */
  date: string
  topWeightLb: number
  e1rmLb: number
}

/**
 * Best top-set weight and best estimated 1RM per program week for one
 * exercise. Deload weeks are left out: lighter efforts there are planned, not
 * a loss of strength.
 */
export function weeklyLiftSeries(
  workouts: readonly WorkoutLog[],
  exercise: Pick<Exercise, 'id' | 'loading'>,
  bodyweightLb?: number,
): LiftPoint[] {
  const byWeek = new Map<number, LiftPoint>()
  const bwPlus = exercise.loading === 'bodyweight-plus'
  for (const w of workouts) {
    if (w.finishedAt === undefined || weekDefinition(w.weekNumber).phase === 'deload') continue
    for (const s of w.sets) {
      if (s.exerciseId !== exercise.id || s.isWarmup || countedReps(s) <= 0) continue
      const e1 = epley(effectiveLoad(s.weightLb, bwPlus, bodyweightLb), countedReps(s))
      const cur = byWeek.get(w.weekNumber)
      if (!cur) byWeek.set(w.weekNumber, { week: w.weekNumber, date: w.date, topWeightLb: s.weightLb, e1rmLb: e1 })
      else {
        cur.topWeightLb = Math.max(cur.topWeightLb, s.weightLb)
        cur.e1rmLb = Math.max(cur.e1rmLb, e1)
        if (w.date < cur.date) cur.date = w.date
      }
    }
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week)
}

export interface StrengthDrop {
  exerciseId: string
  /** Consecutive weekly declines at the end of the series (2 or more). */
  weeks: number
  metric: 'e1rm' | 'top-weight' | 'both'
  /** Percent drop in e1RM from the peak before the decline. */
  percent: number
}

function trailingDeclines(values: number[]): number {
  let n = 0
  for (let i = values.length - 1; i > 0; i--) {
    const a = values[i]
    const b = values[i - 1]
    if (a === undefined || b === undefined || !(a < b - 1e-9)) break
    n++
  }
  return n
}

/** A lift whose top set or e1RM fell in each of the last 2+ trained weeks. */
export function detectStrengthDrop(exerciseId: string, series: readonly LiftPoint[]): StrengthDrop | undefined {
  const e = trailingDeclines(series.map((p) => p.e1rmLb))
  const t = trailingDeclines(series.map((p) => p.topWeightLb))
  const weeks = Math.max(e, t)
  if (weeks < 2) return undefined
  const last = series[series.length - 1]
  const peak = series[series.length - 1 - weeks]
  const percent = last && peak && peak.e1rmLb > 0 ? ((peak.e1rmLb - last.e1rmLb) / peak.e1rmLb) * 100 : 0
  return { exerciseId, weeks, metric: e >= 2 && t >= 2 ? 'both' : e >= 2 ? 'e1rm' : 'top-weight', percent }
}
