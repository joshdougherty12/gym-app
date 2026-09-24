export interface StatusInput {
  /** Loss per week in lb from weekly averages (positive = losing). */
  weeklyLossLb?: number
  /** Latest waist minus waist ~3-4 weeks earlier, inches (negative = smaller). */
  waistChangeIn?: number
  /** Main lifts whose strength fell 2+ weeks running, with their % drop. */
  strengthDrops: { name: string; percent: number }[]
  /** Main lifts with at least 2 trained weeks (so "stable" means something). */
  liftsTracked: number
  /** Average 1-5 fatigue over the last 7 days, and how many check-ins it came from. */
  avgFatigue?: number
  fatigueCount: number
  lossRateMinLb: number
  lossRateMaxLb: number
}

export type StatusLevel = 'green' | 'yellow' | 'red' | 'unknown'

export interface StatusResult {
  level: StatusLevel
  good: string[]
  bad: string[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Progress judging card. Good: strength stable or up, waist down, weight
 * dropping slowly. Bad: big strength drops, constant fatigue, weight falling
 * fast. Red when any bad sign is severe, yellow for milder ones.
 */
export function progressStatus(i: StatusInput): StatusResult {
  const good: string[] = []
  const bad: string[] = []
  let severe = false
  let mild = false
  let anyData = false

  if (i.liftsTracked > 0) {
    anyData = true
    if (i.strengthDrops.length === 0) good.push('Strength stable or up on main lifts')
    else {
      const big = i.strengthDrops.filter((d) => d.percent >= 5)
      if (i.strengthDrops.length >= 2 || big.length > 0) severe = true
      else mild = true
      bad.push(`Strength dropping 2+ weeks: ${i.strengthDrops.map((d) => `${d.name} (−${r1(d.percent)}%)`).join(', ')}`)
    }
  }

  if (i.waistChangeIn !== undefined) {
    anyData = true
    if (i.waistChangeIn < 0) good.push(`Waist down ${r1(-i.waistChangeIn)} in`)
    else if (i.waistChangeIn > 0.25) {
      mild = true
      bad.push(`Waist up ${r1(i.waistChangeIn)} in`)
    }
  }

  if (i.weeklyLossLb !== undefined) {
    anyData = true
    const l = i.weeklyLossLb
    if (l > i.lossRateMaxLb * 1.5) {
      severe = true
      bad.push(`Weight falling fast (${r1(l)} lb/week)`)
    } else if (l > i.lossRateMaxLb) {
      mild = true
      bad.push(`Weight falling a bit fast (${r1(l)} lb/week)`)
    } else if (l >= i.lossRateMinLb) good.push(`Weight dropping slowly (${r1(l)} lb/week)`)
    else if (l < 0) {
      mild = true
      bad.push(`Weight up ${r1(-l)} lb this week`)
    } else {
      mild = true
      bad.push(`Weight loss slow (${r1(l)} lb/week)`)
    }
  }

  if (i.avgFatigue !== undefined && i.fatigueCount >= 3) {
    anyData = true
    if (i.avgFatigue >= 4) {
      severe = true
      bad.push(`Constant fatigue (avg ${r1(i.avgFatigue)}/5)`)
    } else if (i.avgFatigue >= 3.5) {
      mild = true
      bad.push(`Fatigue creeping up (avg ${r1(i.avgFatigue)}/5)`)
    }
  }

  const level: StatusLevel = !anyData ? 'unknown' : severe ? 'red' : mild ? 'yellow' : 'green'
  return { level, good, bad }
}
