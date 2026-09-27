import { describe, expect, it } from 'vitest'
import { groceryItemsFromPlan, groupBySection, splitLegacyPlan } from './kitchen'

const grocery = {
  sections: [
    { name: 'Produce', items: [{ item: 'Spinach', quantity: '1 bag', estCostUsd: 3, forMeals: [] }, { item: 'Lemons', quantity: '2', estCostUsd: 1, forMeals: [] }] },
    { name: 'Pantry', items: [{ item: 'Oats', quantity: '1 canister', estCostUsd: 4, forMeals: [] }] },
  ],
  estTotalUsd: 8,
  pantryStaplesAssumed: ['salt'],
  recipes: [{ name: 'Salmon', servings: 2, ingredients: ['salmon'], steps: ['bake'], tip: '', perServing: { calories: 400, proteinG: 35, satFatG: 2, fiberG: 1, carbsG: 5, fatG: 20 } }],
  shoppingTips: ['buy frozen fish'],
}

describe('grocery list rows', () => {
  it('turns a list into ordered rows and groups them back', () => {
    const items = groceryItemsFromPlan(grocery, 'L', (n) => `i${n}`)
    expect(items.map((i) => [i.id, i.section, i.item, i.order])).toEqual([
      ['i0', 'Produce', 'Spinach', 0],
      ['i1', 'Produce', 'Lemons', 1],
      ['i2', 'Pantry', 'Oats', 2],
    ])
    expect(groupBySection([...items].reverse()).map((s) => [s.name, s.items.map((i) => i.item)])).toEqual([
      ['Produce', ['Spinach', 'Lemons']],
      ['Pantry', ['Oats']],
    ])
  })

  it('splits a pre-1.8 plan, keeping what was checked', () => {
    const legacy = { ideas: [], selected: ['a'], notes: 'n', grocery, groceryFor: ['a'], checked: ['Produce|Lemons'] }
    const split = splitLegacyPlan(legacy, 'L', (n) => `i${n}`)
    expect(split?.plan).toEqual({ ideas: [], selected: ['a'], notes: 'n', groceryFor: ['a'], grocery: { listId: 'L', estTotalUsd: 8, pantryStaplesAssumed: ['salt'], shoppingTips: ['buy frozen fish'], recipes: grocery.recipes } })
    expect(split?.items.filter((i) => i.checked).map((i) => i.item)).toEqual(['Lemons'])
    // Already converted: nothing to do.
    expect(splitLegacyPlan(split?.plan, 'L', (n) => `i${n}`)).toBeNull()
    expect(splitLegacyPlan({ ideas: [], selected: [], notes: '', checked: [] }, 'L', String)).toEqual({ plan: { ideas: [], selected: [], notes: '' }, items: [] })
  })
})
