import { describe, expect, it } from 'vitest'
import { matchIdea, mealFromRecipe, perServingLine, recipeFromIdea, recipeFromPlan, recipeText, type RecipeDraft } from './recipes'

const chili: RecipeDraft = {
  name: 'Turkey chili',
  servings: 4,
  ingredients: ['1 lb lean ground turkey', '1 can black beans'],
  steps: ['Brown the turkey.', 'Add beans and simmer 20 min.'],
  tip: 'Freezes well.',
  prepMinutes: 35,
  calories: 520,
  proteinG: 42,
  satFatG: 3,
  fiberG: 11,
  carbsG: 48,
  fatG: 14,
}

describe('recipe to meal', () => {
  it('uses the exact per-serving numbers times the servings eaten', () => {
    const m = mealFromRecipe(chili, { servings: 1.5, date: '2026-09-26', mealType: 'dinner' })
    expect(m).toMatchObject({ date: '2026-09-26', mealType: 'dinner', name: 'Turkey chili', calories: 780, proteinG: 63, satFatG: 4.5, fiberG: 16.5, carbsG: 72, fatG: 21, source: 'recipe' })
    expect(m.items).toEqual([{ name: 'Turkey chili', portion: '1.5 servings', calories: 780, proteinG: 63, satFatG: 4.5, fiberG: 16.5 }])
    expect(m.id).toMatch(/^meal-/)
  })

  it('logs one serving unchanged and half a serving halved', () => {
    expect(mealFromRecipe(chili, { servings: 1, date: 'd', mealType: 'lunch' })).toMatchObject({ calories: 520, proteinG: 42, satFatG: 3 })
    const half = mealFromRecipe(chili, { servings: 0.5, date: 'd', mealType: 'lunch' })
    expect(half).toMatchObject({ calories: 260, proteinG: 21, satFatG: 1.5, fiberG: 5.5 })
    expect(half.items[0]?.portion).toBe('0.5 servings')
  })

  it('leaves out numbers the recipe does not have', () => {
    const { satFatG: _s, fiberG: _f, carbsG: _c, fatG: _t, ...bare } = chili
    const m = mealFromRecipe(bare, { servings: 2, date: 'd', mealType: 'snack' })
    expect(m.calories).toBe(1040)
    expect('satFatG' in m).toBe(false)
    expect('carbsG' in m).toBe(false)
  })
})

describe('recipe as plain text', () => {
  it('has the name, servings, per-serving numbers, ingredients, numbered steps and tip', () => {
    expect(recipeText(chili)).toBe(
      [
        'TURKEY CHILI',
        'Serves 4 · 35 min',
        'Per serving: 520 kcal · 42 g protein · 48 g carbs · 14 g fat · 3 g sat fat · 11 g fiber',
        '',
        'INGREDIENTS',
        '• 1 lb lean ground turkey',
        '• 1 can black beans',
        '',
        'STEPS',
        '1. Brown the turkey.',
        '2. Add beans and simmer 20 min.',
        '',
        'Tip: Freezes well.',
      ].join('\n'),
    )
  })

  it('skips missing numbers and an empty tip', () => {
    expect(perServingLine({ calories: 400.4, proteinG: 30.25 })).toBe('400 kcal · 30.3 g protein')
    expect(recipeText({ ...chili, tip: undefined, prepMinutes: undefined })).not.toMatch(/Tip:|min\n/)
  })
})

describe('recipes from Claude suggestions', () => {
  it('turns a meal idea into a one-serving recipe', () => {
    const r = recipeFromIdea({ name: 'Egg white wrap', calories: 410.6, proteinG: 38.44, satFatG: 2.26, fiberG: 9, carbsG: 40, fatG: 9, prepMinutes: 10, ingredients: ['4 egg whites'], steps: ['Cook.'] })
    expect(r).toEqual({ name: 'Egg white wrap', servings: 1, ingredients: ['4 egg whites'], steps: ['Cook.'], prepMinutes: 10, calories: 411, proteinG: 38.4, satFatG: 2.3, fiberG: 9, carbsG: 40, fatG: 9 })
  })

  it('handles cached ideas from before carbs and fat were asked for', () => {
    const r = recipeFromIdea({ name: 'Old', calories: 500, proteinG: 40, satFatG: 3, fiberG: 6, ingredients: [], steps: [] })
    expect('carbsG' in r).toBe(false)
  })

  it('uses a plan recipe\'s own per-serving numbers, or the dinner idea for older lists', () => {
    const rc = { name: 'Sheet-pan salmon', servings: 4, ingredients: ['salmon'], steps: ['Roast.'], tip: '', perServing: { calories: 600, proteinG: 45, satFatG: 3, fiberG: 8, carbsG: 50, fatG: 20 } }
    expect(recipeFromPlan(rc)).toMatchObject({ servings: 4, calories: 600, proteinG: 45 })
    expect('tip' in recipeFromPlan(rc)).toBe(false)
    const { perServing: _p, ...old } = rc
    const idea = { name: 'Sheet-Pan Salmon ', calories: 650, proteinG: 48, satFatG: 3.5, fiberG: 7, prepMinutes: 30 }
    expect(recipeFromPlan(old, matchIdea(old.name, 5, [idea]))).toMatchObject({ calories: 650, proteinG: 48, prepMinutes: 30 })
  })

  it('matches a plan recipe to its dinner by name, else by position', () => {
    const ideas = [{ name: 'A' }, { name: 'B' }]
    expect(matchIdea('b', 0, ideas)?.name).toBe('B')
    expect(matchIdea('Renamed', 1, ideas)?.name).toBe('B')
    expect(matchIdea('Renamed', 5, ideas)).toBeUndefined()
  })
})
