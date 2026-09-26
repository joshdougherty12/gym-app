import { describe, expect, it } from 'vitest'
import { groceryText, mealTypeForTime, nextMealType, scaleMeal, sumMeals } from './meals'

const at = (h: number, m = 0) => new Date(2026, 8, 25, h, m)

describe('meal type from time', () => {
  it('maps times of day to meals', () => {
    expect(mealTypeForTime(at(7))).toBe('breakfast')
    expect(mealTypeForTime(at(10, 45))).toBe('lunch')
    expect(mealTypeForTime(at(15, 30))).toBe('snack')
    expect(mealTypeForTime(at(18))).toBe('dinner')
    expect(mealTypeForTime(at(23))).toBe('snack')
    expect(mealTypeForTime(at(2))).toBe('snack')
  })

  it('picks the next meal to plan', () => {
    expect(nextMealType(at(8))).toBe('breakfast')
    expect(nextMealType(at(12))).toBe('lunch')
    expect(nextMealType(at(17))).toBe('dinner')
    expect(nextMealType(at(22))).toBe('snack')
  })
})

describe('sumMeals', () => {
  it('adds calories, protein, saturated fat and fiber; missing values count as 0', () => {
    const t = sumMeals([
      { calories: 500, proteinG: 40, satFatG: 3, fiberG: 8 },
      { calories: 300, proteinG: 25 },
    ])
    expect(t).toEqual({ calories: 800, proteinG: 65, satFatG: 3, fiberG: 8, count: 2 })
  })

  it('is zero for no meals', () => {
    expect(sumMeals([]).calories).toBe(0)
  })
})

describe('scaleMeal', () => {
  it('scales the meal and its items, rounding sensibly', () => {
    const m = scaleMeal({ calories: 700, proteinG: 45, satFatG: 4, fiberG: 9, items: [{ name: 'rice', portion: '1 cup', calories: 200, proteinG: 4, fiberG: 1 }] }, 0.75)
    expect(m.calories).toBe(525)
    expect(m.proteinG).toBe(33.8)
    expect(m.satFatG).toBe(3)
    expect(m.items[0]).toEqual({ name: 'rice', portion: '1 cup', calories: 150, proteinG: 3, fiberG: 0.8 })
    expect('carbsG' in m).toBe(false)
  })
})

describe('groceryText', () => {
  it('formats a shareable checklist by section', () => {
    const t = groceryText(
      { sections: [{ name: 'Produce', items: [{ item: 'Spinach', quantity: '1 bag' }] }, { name: 'Empty', items: [] }], estTotalUsd: 61.4, pantryStaplesAssumed: ['olive oil', 'salt'] },
      ['Salmon bowls', 'Turkey chili'],
    )
    expect(t).toContain('about $61')
    expect(t).toContain('PRODUCE\n☐ Spinach (1 bag)')
    expect(t).not.toContain('EMPTY')
    expect(t).toContain('olive oil, salt')
  })
})
