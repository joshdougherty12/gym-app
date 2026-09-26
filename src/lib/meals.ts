import type { Meal, MealType } from '../types'

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

/** Best guess at which meal a photo is, from the local time it was taken. */
export function mealTypeForTime(d: Date): MealType {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 10.5 && h < 15) return 'lunch'
  if (h >= 16.5 && h < 21.5) return 'dinner'
  return 'snack'
}

/** The next main meal to plan for, given the time. */
export function nextMealType(d: Date): MealType {
  const h = d.getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export interface DayTotals {
  calories: number
  proteinG: number
  satFatG: number
  fiberG: number
  count: number
}

export function sumMeals(meals: readonly Pick<Meal, 'calories' | 'proteinG' | 'satFatG' | 'fiberG'>[]): DayTotals {
  return meals.reduce<DayTotals>(
    (t, m) => ({
      calories: t.calories + m.calories,
      proteinG: t.proteinG + m.proteinG,
      satFatG: t.satFatG + (m.satFatG ?? 0),
      fiberG: t.fiberG + (m.fiberG ?? 0),
      count: t.count + 1,
    }),
    { calories: 0, proteinG: 0, satFatG: 0, fiberG: 0, count: 0 },
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Scale a meal's numbers (e.g. "I ate about 3/4 of it"). Items scale too. */
export function scaleMeal<T extends Pick<Meal, 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'satFatG' | 'fiberG' | 'items'>>(m: T, factor: number): T {
  const s = (n: number | undefined) => (n === undefined ? undefined : round1(n * factor))
  const out = {
    ...m,
    calories: Math.round(m.calories * factor),
    proteinG: round1(m.proteinG * factor),
    items: m.items.map((i) => ({ ...i, calories: Math.round(i.calories * factor), proteinG: round1(i.proteinG * factor), ...(i.satFatG !== undefined ? { satFatG: round1(i.satFatG * factor) } : {}), ...(i.fiberG !== undefined ? { fiberG: round1(i.fiberG * factor) } : {}) })),
  }
  for (const k of ['carbsG', 'fatG', 'satFatG', 'fiberG'] as const) {
    const v = s(m[k])
    if (v === undefined) delete out[k]
    else out[k] = v
  }
  return out
}

/** Plain-text grocery list for sharing (text message, notes app). */
export function groceryText(plan: { sections: { name: string; items: { item: string; quantity: string }[] }[]; estTotalUsd: number; pantryStaplesAssumed: string[] }, meals: string[]): string {
  const lines: string[] = [`Groceries for this week (about $${Math.round(plan.estTotalUsd)})`, '', `Dinners: ${meals.join(', ')}`, '']
  for (const s of plan.sections) {
    if (!s.items.length) continue
    lines.push(s.name.toUpperCase())
    for (const i of s.items) lines.push(`☐ ${i.item} (${i.quantity})`)
    lines.push('')
  }
  if (plan.pantryStaplesAssumed.length) lines.push(`Already have (check): ${plan.pantryStaplesAssumed.join(', ')}`)
  return lines.join('\n').trim()
}
