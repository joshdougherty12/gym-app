import type { Exercise, PhaseId, RirRange } from '../types'

/** One working set from a past session (warm-ups already removed). */
export interface PastSet {
  weightLb: number
  /** Reps; for per-side exercises the weaker side. */
  reps: number
  rir: number
  durationSec?: number
}

export interface PastSession {
  date: string
  /** Target RIR that applied when this session was done. */
  targetRir: RirRange
  sets: PastSet[]
}

export interface SetTarget {
  /** null = no history yet, the lifter picks a starting weight. */
  weightLb: number | null
  /** Target reps, or seconds for timed exercises. */
  reps: number
}

export type SuggestionKind =
  | 'first-time'
  | 'increase'
  | 'big-increase'
  | 'add-reps'
  | 'hold'
  | 'reduce'
  | 'deload'
  | 'timed-add-seconds'
  | 'timed-add-weight'
  | 'timed-harder-variation'
  | 'top-no-increment'

export interface Suggestion {
  kind: SuggestionKind
  sets: SetTarget[]
  /** Plain-language reasoning shown on the workout screen. */
  reason: string
  flag?: 'missed-bottom-twice' | 'below-range' | 'rir-too-low'
}

export interface ProgressionInput {
  exercise: Pick<Exercise, 'type' | 'incrementLb' | 'perSide' | 'timedProgression' | 'loading'>
  repMin: number
  repMax: number
  /** Working sets planned for today. */
  sets: number
  /** Phase of today's week (deload keeps weights). */
  phase: PhaseId
  todayRir: RirRange
  /** Most recent first. Only sessions with at least one working set. */
  history: readonly PastSession[]
  formatWeight?: (lb: number) => string
}

const defaultFormat = (lb: number) => `${Number.isInteger(lb) ? lb : Math.round(lb * 100) / 100} lb`

/** Round down to a multiple of the increment (never below 0). */
export function roundDownTo(weight: number, increment: number): number {
  if (increment <= 0) return weight
  return Math.max(0, Math.floor(weight / increment + 1e-9) * increment)
}

/** How far the average logged RIR sits from the target: "much higher" / "much lower" / "on target". */
export function rirVerdict(avgRir: number, target: RirRange): 'much-higher' | 'much-lower' | 'on-target' {
  if (avgRir >= target.max + 2) return 'much-higher'
  if (avgRir <= target.min - 2) return 'much-lower'
  return 'on-target'
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function repList(sets: PastSet[], timed: boolean): string {
  return sets.map((s) => (timed ? `${s.durationSec ?? s.reps}s` : String(s.reps))).join('/')
}

/** Today's per-set targets, extending or trimming last session's sets to today's set count. */
function perSet(count: number, from: (i: number) => SetTarget): SetTarget[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => from(i))
}

function missedBottom(s: PastSession, repMin: number): boolean {
  return s.sets.some((x) => x.reps < repMin)
}

/** Working weight of a session: the heaviest working set. */
function topWeight(s: PastSession): number {
  return Math.max(...s.sets.map((x) => x.weightLb))
}

export function suggest(input: ProgressionInput): Suggestion {
  const { exercise, repMin, repMax, sets, phase, todayRir, history } = input
  const fmt = input.formatWeight ?? defaultFormat
  const timed = exercise.type === 'timed'
  const last = history[0]

  if (!last || last.sets.length === 0) {
    const rirText = todayRir.min === todayRir.max ? `${todayRir.min}` : `${todayRir.min}-${todayRir.max}`
    return {
      kind: 'first-time',
      sets: perSet(sets, () => ({ weightLb: null, reps: repMin })),
      reason: timed
        ? `First time: hold for ${repMin}s each set.`
        : `First time: pick a weight you can lift for ${repMin} reps with ${rirText} reps left in the tank.`,
    }
  }

  const weight = topWeight(last)
  const lastSet = (i: number): PastSet => last.sets[Math.min(i, last.sets.length - 1)] as PastSet
  const did = repList(last.sets, timed)

  // Deload: same weight, fewer sets (the set count is already reduced), easy reps.
  if (phase === 'deload') {
    return {
      kind: 'deload',
      sets: perSet(sets, (i) => ({ weightLb: lastSet(i).weightLb, reps: repMin })),
      reason: `Deload week: keep ${fmt(weight)}, do fewer sets and stop about 4 reps short.`,
    }
  }

  // Timed exercises: +5 s per set until the top of the range.
  if (timed) {
    const durations = last.sets.map((s) => s.durationSec ?? s.reps)
    const allTop = durations.every((d) => d >= repMax)
    if (allTop) {
      if (exercise.timedProgression === 'harder-variation' || exercise.incrementLb <= 0) {
        return {
          kind: 'timed-harder-variation',
          sets: perSet(sets, (i) => ({ weightLb: lastSet(i).weightLb, reps: repMax })),
          reason: `Held ${did} last time, the top of the range. Time for a harder variation: swap the exercise.`,
        }
      }
      const w = weight + exercise.incrementLb
      return {
        kind: 'timed-add-weight',
        sets: perSet(sets, () => ({ weightLb: w, reps: repMin })),
        reason: `Held ${did} last time, the top of the range, so add weight: ${fmt(w)} for ${repMin}s.`,
      }
    }
    return {
      kind: 'timed-add-seconds',
      sets: perSet(sets, (i) => ({
        weightLb: lastSet(i).weightLb,
        reps: Math.min(repMax, Math.max(repMin, (durations[Math.min(i, durations.length - 1)] ?? repMin) + 5)),
      })),
      reason: `Held ${did} last time, so add 5 seconds per set (top: ${repMax}s).`,
    }
  }

  const inc = exercise.incrementLb
  const verdict = rirVerdict(mean(last.sets.map((s) => s.rir)), last.targetRir)
  const allTop = last.sets.every((s) => s.reps >= repMax)

  // Missed the bottom of the range two sessions running: back off.
  const prev = history[1]
  if (!allTop && missedBottom(last, repMin) && prev && missedBottom(prev, repMin) && topWeight(prev) <= weight + 1e-9) {
    const reduced = inc > 0 ? Math.min(weight - inc, roundDownTo(weight * 0.925, inc)) : weight
    const w = Math.max(0, reduced)
    return {
      kind: inc > 0 ? 'reduce' : 'hold',
      sets: perSet(sets, () => ({ weightLb: w, reps: repMin })),
      reason:
        inc > 0
          ? `Below ${repMin} reps two sessions in a row (${did} last time), so drop to ${fmt(w)} and build back up from ${repMin}.`
          : `Below ${repMin} reps two sessions in a row. Hold here, or swap to an easier variation.`,
      flag: 'missed-bottom-twice',
    }
  }

  if (allTop) {
    if (verdict === 'much-lower') {
      return {
        kind: 'hold',
        sets: perSet(sets, () => ({ weightLb: weight, reps: repMax })),
        reason: `Hit ${did} last time, but at ~${Math.round(mean(last.sets.map((s) => s.rir)))} RIR, harder than planned. Stay at ${fmt(weight)} and own it.`,
        flag: 'rir-too-low',
      }
    }
    if (inc <= 0) {
      return {
        kind: 'top-no-increment',
        sets: perSet(sets, () => ({ weightLb: weight, reps: repMax })),
        reason: `Hit ${did} last time, the top of the range. Add a little load (dumbbell or ankle weight) or swap to a harder variation.`,
      }
    }
    const big = verdict === 'much-higher'
    const w = weight + inc * (big ? 2 : 1)
    return {
      kind: big ? 'big-increase' : 'increase',
      sets: perSet(sets, () => ({ weightLb: w, reps: repMin })),
      reason: big
        ? `Hit ${did} last time with lots left in the tank, so jump to ${fmt(w)} for ${repMin} reps.`
        : `Hit ${did} last time, so try ${fmt(w)} for ${repMin} reps.`,
    }
  }

  if (verdict === 'much-lower') {
    return {
      kind: 'hold',
      sets: perSet(sets, (i) => ({ weightLb: lastSet(i).weightLb, reps: Math.min(repMax, lastSet(i).reps) })),
      reason: `Got ${did} last time, but closer to failure than planned. Repeat ${fmt(weight)} and hit the same reps with more in reserve.`,
      flag: 'rir-too-low',
    }
  }

  if (verdict === 'much-higher' && inc > 0) {
    const w = weight + inc
    return {
      kind: 'big-increase',
      sets: perSet(sets, (i) => ({ weightLb: w, reps: Math.max(repMin, Math.min(repMax, lastSet(i).reps)) })),
      reason: `Got ${did} last time with lots left in the tank, so go up to ${fmt(w)}.`,
    }
  }

  const below = missedBottom(last, repMin)
  return {
    kind: 'add-reps',
    sets: perSet(sets, (i) => {
      const s = lastSet(i)
      return { weightLb: s.weightLb, reps: s.reps >= repMax ? repMax : s.reps + 1 }
    }),
    reason: below
      ? `Got ${did} last time, under ${repMin}. Same ${fmt(weight)}, aim for one more rep per set.`
      : `Got ${did} last time. Same ${fmt(weight)}, add a rep on sets under ${repMax}.`,
    ...(below ? { flag: 'below-range' as const } : {}),
  }
}
