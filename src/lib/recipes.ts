import type { Meal, MealType, Recipe } from '../types'
import { newId, timestamp } from './id'

/** A recipe before it is saved (no id or save time yet). */
export type RecipeDraft = Omit<Recipe, 'id' | 'savedAt'>

const round1 = (n: number) => Math.round(n * 10) / 10

interface PerServing {
  calories: number
  proteinG: number
  satFatG?: number
  fiberG?: number
  // Older cached suggestions have no carbs or fat.
  carbsG?: number
  fatG?: number
}

function nutrition(n: PerServing): Pick<Recipe, 'calories' | 'proteinG' | 'satFatG' | 'fiberG' | 'carbsG' | 'fatG'> {
  const out: Pick<Recipe, 'calories' | 'proteinG' | 'satFatG' | 'fiberG' | 'carbsG' | 'fatG'> = { calories: Math.round(n.calories), proteinG: round1(n.proteinG) }
  for (const k of ['satFatG', 'fiberG', 'carbsG', 'fatG'] as const) {
    const v = n[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = round1(v)
  }
  return out
}

/** A "What should I eat?" idea: one serving. */
export function recipeFromIdea(i: PerServing & { name: string; ingredients: string[]; steps: string[]; prepMinutes?: number }): RecipeDraft {
  return {
    name: i.name,
    servings: 1,
    ingredients: [...i.ingredients],
    steps: [...i.steps],
    ...(i.prepMinutes ? { prepMinutes: Math.round(i.prepMinutes) } : {}),
    ...nutrition(i),
  }
}

/**
 * A recipe from the week plan. Its per-serving numbers come from the recipe
 * itself; lists made before recipes carried nutrition fall back to the dinner
 * idea it was written for.
 */
export function recipeFromPlan(rc: { name: string; servings: number; ingredients: string[]; steps: string[]; tip: string; perServing?: PerServing }, idea?: PerServing & { prepMinutes?: number }): RecipeDraft {
  const n = rc.perServing ?? idea ?? { calories: 0, proteinG: 0 }
  return {
    name: rc.name,
    servings: rc.servings > 0 ? rc.servings : 1,
    ingredients: [...rc.ingredients],
    steps: [...rc.steps],
    ...(rc.tip ? { tip: rc.tip } : {}),
    ...(idea?.prepMinutes ? { prepMinutes: Math.round(idea.prepMinutes) } : {}),
    ...nutrition(n),
  }
}

/** Find the dinner idea a plan recipe was written for: same name, else same position. */
export function matchIdea<T extends { name: string }>(recipeName: string, index: number, ideas: readonly T[]): T | undefined {
  const norm = (s: string) => s.trim().toLowerCase()
  return ideas.find((i) => norm(i.name) === norm(recipeName)) ?? ideas[index]
}

const fmt = (n: number) => String(round1(n))

/** One line of per-serving numbers, e.g. "520 kcal · 42 g protein · 3 g sat fat · 8 g fiber". */
export function perServingLine(r: Pick<Recipe, 'calories' | 'proteinG' | 'satFatG' | 'fiberG' | 'carbsG' | 'fatG'>): string {
  return [
    `${Math.round(r.calories)} kcal`,
    `${fmt(r.proteinG)} g protein`,
    r.carbsG !== undefined ? `${fmt(r.carbsG)} g carbs` : '',
    r.fatG !== undefined ? `${fmt(r.fatG)} g fat` : '',
    r.satFatG !== undefined ? `${fmt(r.satFatG)} g sat fat` : '',
    r.fiberG !== undefined ? `${fmt(r.fiberG)} g fiber` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Clean plain text for sharing or copying. */
export function recipeText(r: RecipeDraft): string {
  const head = [`Serves ${fmt(r.servings)}`, r.prepMinutes ? `${r.prepMinutes} min` : ''].filter(Boolean).join(' · ')
  const lines = [r.name.toUpperCase(), head, `Per serving: ${perServingLine(r)}`, '', 'INGREDIENTS', ...r.ingredients.map((i) => `• ${i}`), '', 'STEPS', ...r.steps.map((s, k) => `${k + 1}. ${s}`)]
  if (r.tip) lines.push('', `Tip: ${r.tip}`)
  return lines.join('\n')
}

/** Log a recipe as a meal: its exact per-serving numbers times the servings eaten. No AI call. */
export function mealFromRecipe(r: RecipeDraft, opts: { servings: number; date: string; mealType: MealType }): Meal {
  const f = opts.servings
  const s = (n: number | undefined) => (n === undefined ? undefined : round1(n * f))
  const portion = `${fmt(f)} serving${f === 1 ? '' : 's'}`
  const meal: Meal = {
    id: newId('meal'),
    date: opts.date,
    loggedAt: timestamp(),
    mealType: opts.mealType,
    name: r.name,
    items: [{ name: r.name, portion, calories: Math.round(r.calories * f), proteinG: round1(r.proteinG * f), ...(r.satFatG !== undefined ? { satFatG: round1(r.satFatG * f) } : {}), ...(r.fiberG !== undefined ? { fiberG: round1(r.fiberG * f) } : {}) }],
    calories: Math.round(r.calories * f),
    proteinG: round1(r.proteinG * f),
    notes: `Logged from a recipe: ${portion}.`,
    source: 'recipe',
  }
  for (const k of ['carbsG', 'fatG', 'satFatG', 'fiberG'] as const) {
    const v = s(r[k])
    if (v !== undefined) meal[k] = v
  }
  return meal
}

/** Same recipe name, ignoring case and spacing. */
export function sameRecipe(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
