// Suggested portions when a couple eats the same dish.
//
// Rule (shown to the user): portions scale with each person's calorie target.
// Two servings are split in proportion to the two targets, so someone with a
// 2,400 kcal target and someone with 1,600 get 1.2 and 0.8 servings.

const round1 = (n: number) => Math.round(n * 10) / 10

export interface PortionSplit {
  mine: number
  theirs: number
}

export function portionSplit(myTarget: number, theirTarget: number): PortionSplit {
  if (!(myTarget > 0) || !(theirTarget > 0)) return { mine: 1, theirs: 1 }
  const avg = (myTarget + theirTarget) / 2
  // Keep it sensible: never below a quarter or above double a serving.
  const clamp = (n: number) => Math.min(2, Math.max(0.25, round1(n)))
  return { mine: clamp(myTarget / avg), theirs: clamp(theirTarget / avg) }
}

const fmt = (n: number) => `${n} serving${n === 1 ? '' : 's'}`

/** e.g. "Josh 1.2 servings · Sam 0.8 servings". */
export function portionLine(myName: string, theirName: string, s: PortionSplit): string {
  return `${myName} ${fmt(s.mine)} · ${theirName} ${fmt(s.theirs)}`
}
