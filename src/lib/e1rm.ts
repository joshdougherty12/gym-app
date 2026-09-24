/** Epley estimated one-rep max. 1 rep returns the weight itself; 0 reps returns 0. */
export function epley(weightLb: number, reps: number): number {
  if (reps <= 0 || weightLb <= 0) return 0
  if (reps === 1) return weightLb
  return weightLb * (1 + reps / 30)
}

/**
 * Load used for e1RM. For weighted pull-ups and similar, the bar moves your
 * bodyweight plus whatever is added, so e1RM uses the sum.
 */
export function effectiveLoad(weightLb: number, bodyweightPlus: boolean, bodyweightLb?: number): number {
  return bodyweightPlus ? weightLb + (bodyweightLb ?? 0) : weightLb
}
