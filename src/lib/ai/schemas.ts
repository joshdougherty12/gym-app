import { z } from 'zod'

// Shapes Claude must return (structured outputs). Numbers are estimates.

const Nutrients = {
  calories: z.number().describe('kcal'),
  proteinG: z.number(),
  satFatG: z.number().describe('saturated fat, grams'),
  fiberG: z.number(),
}

export const MealEstimateSchema = z.object({
  isFood: z.boolean().describe('false if the photo does not show food or drink'),
  mealName: z.string().describe('short name, e.g. "Chicken burrito bowl"'),
  items: z.array(
    z.object({
      name: z.string(),
      portion: z.string().describe('estimated amount, e.g. "1 cup", "6 oz"'),
      ...Nutrients,
    }),
  ),
  totals: z.object({ ...Nutrients, carbsG: z.number(), fatG: z.number() }),
  confidence: z.enum(['low', 'medium', 'high']),
  assumptions: z.string().describe('one short sentence on what was assumed (oil, sauce, portion size)'),
  heartTip: z.string().describe('one short, practical tip for the cholesterol/cut goals, or empty string'),
})
export type MealEstimate = z.infer<typeof MealEstimateSchema>

const Idea = z.object({
  name: z.string(),
  why: z.string().describe('one short line on why it fits today'),
  ...Nutrients,
  estCostUsd: z.number().describe('rough cost per serving in USD'),
  prepMinutes: z.number(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()).describe('3-6 short steps'),
})
export type MealIdea = z.infer<typeof Idea>

export const MealIdeasSchema = z.object({ ideas: z.array(Idea) })

export const WeekIdeasSchema = z.object({
  meals: z.array(
    z.object({
      id: z.string().describe('short unique slug'),
      name: z.string(),
      description: z.string().describe('one or two appetizing sentences'),
      cuisine: z.string(),
      ...Nutrients,
      estCostPerServingUsd: z.number(),
      prepMinutes: z.number(),
      leftoversForLunch: z.boolean(),
    }),
  ),
})
export type WeekIdea = z.infer<typeof WeekIdeasSchema>['meals'][number]

export const GroceryPlanSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().describe('store section, e.g. Produce, Meat & Fish, Dairy, Pantry, Frozen'),
      items: z.array(
        z.object({
          item: z.string(),
          quantity: z.string(),
          estCostUsd: z.number(),
          forMeals: z.array(z.string()),
        }),
      ),
    }),
  ),
  estTotalUsd: z.number(),
  pantryStaplesAssumed: z.array(z.string()),
  recipes: z.array(
    z.object({
      name: z.string(),
      servings: z.number(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()),
      tip: z.string(),
    }),
  ),
  shoppingTips: z.array(z.string()),
})
export type GroceryPlan = z.infer<typeof GroceryPlanSchema>
