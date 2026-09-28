import type { Loading } from '../types'

/** Epley estimated one-rep max. 1 rep returns the weight itself; 0 reps returns 0. */
export function epley(weightLb: number, reps: number): number {
  if (reps <= 0 || weightLb <= 0) return 0
  if (reps === 1) return weightLb
  return weightLb * (1 + reps / 30)
}

/**
 * Load used for e1RM. For pull-ups and similar, the bar moves your bodyweight
 * plus whatever is added, so e1RM uses the sum. On an assisted machine the
 * weight is help, so the load is bodyweight minus it (0 when bodyweight is unknown).
 */
export function effectiveLoad(weightLb: number, loading: Loading, bodyweightLb?: number): number {
  if (loading === 'bodyweight-plus') return weightLb + (bodyweightLb ?? 0)
  if (loading === 'assisted') return bodyweightLb ? Math.max(0, bodyweightLb - weightLb) : 0
  return weightLb
}
