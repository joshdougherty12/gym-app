import { z } from 'zod'

// Shapes of what partners share. Everything arriving from the other phone is
// checked against these before it touches the database.

/** Record types that travel between partners. */
// 'steps' (1.9.0), 'asum' (1.10.0): older app versions skip record types they don't know, so adding one is safe.
export const RECORD_TYPES = ['recipe', 'plan', 'grocery', 'member', 'wsum', 'event', 'steps', 'asum'] as const
export type RecordType = (typeof RECORD_TYPES)[number]

const num = z.number().finite()
const optNum = num.optional()

export const RecipeData = z.object({
  savedAt: num,
  name: z.string().max(300),
  servings: num,
  ingredients: z.array(z.string().max(500)).max(100),
  steps: z.array(z.string().max(2000)).max(50),
  tip: z.string().max(2000).optional(),
  prepMinutes: optNum,
  calories: num,
  proteinG: num,
  satFatG: optNum,
  fiberG: optNum,
  carbsG: optNum,
  fatG: optNum,
})

export const GroceryItemData = z.object({
  listId: z.string().max(80),
  section: z.string().max(100),
  item: z.string().max(300),
  quantity: z.string().max(200),
  estCostUsd: num,
  order: num,
  checked: z.boolean(),
})
export type GroceryItemData = z.infer<typeof GroceryItemData>

/** Everything about a member one partner needs: display name and, if shared, the calorie target. */
export const MemberData = z.object({
  name: z.string().max(60),
  calorieTarget: num.optional(),
  sharesWorkouts: z.boolean(),
  /** 1.10.0+: shares run and ride summaries (absent from older versions, which share none). */
  sharesActivities: z.boolean().optional(),
})
export type MemberData = z.infer<typeof MemberData>

/** A finished workout, summarized. No bodyweight, no individual sets beyond the best few. */
export const WorkoutSummaryData = z.object({
  date: z.string().max(10),
  name: z.string().max(120),
  minutes: num,
  setsDone: num,
  prs: z.array(z.object({ exercise: z.string().max(120), kind: z.enum(['e1rm', 'weight']), valueLb: num, addedLoad: z.boolean() })).max(20),
  best: z.array(z.object({ exercise: z.string().max(120), weightLb: num, reps: num, addedLoad: z.boolean() })).max(8),
  finishedAt: num,
})
export type WorkoutSummaryData = z.infer<typeof WorkoutSummaryData>

/**
 * A finished GPS activity, summarized for the partner. Never the route, any
 * coordinate or the start location: only what is listed here (strict, so an
 * extra field is rejected on the way in).
 */
export const ActivitySummaryData = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(['run', 'walk', 'bike', 'hike']),
    distanceM: num.min(0).max(1_000_000),
    movingMs: num.min(0).max(7 * 24 * 3600 * 1000),
    avgSpeedMps: num.min(0).max(100),
    finishedAt: num,
  })
  .strict()
export type ActivitySummaryData = z.infer<typeof ActivitySummaryData>

/** Per-serving nutrition of a recipe someone ate, so the partner can log the same thing. */
export const SharedRecipeNutrition = z.object({
  name: z.string().max(300),
  calories: num,
  proteinG: num,
  satFatG: optNum,
  fiberG: optNum,
  carbsG: optNum,
  fatG: optNum,
})
export type SharedRecipeNutrition = z.infer<typeof SharedRecipeNutrition>

/** Today's step count, one record per member (replaced each day). */
export const StepsShareData = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(100_000),
  at: num,
})
export type StepsShareData = z.infer<typeof StepsShareData>

export const EventData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('highfive'), at: num, workoutId: z.string().max(80).optional() }),
  z.object({ kind: z.literal('nudge'), at: num }),
  z.object({ kind: z.literal('atethis'), at: num, recipe: SharedRecipeNutrition }),
])
export type EventData = z.infer<typeof EventData>

/** Week plan (shared): dinner ideas, picks, notes and the grocery list's header. Items are separate records. */
export interface SharedGroceryHeader {
  listId: string
  estTotalUsd: number
  pantryStaplesAssumed: string[]
  shoppingTips: string[]
  recipes: { name: string; servings: number; ingredients: string[]; steps: string[]; tip: string; perServing?: { calories: number; proteinG: number; satFatG: number; fiberG: number; carbsG: number; fatG: number } }[]
}

export const PlanData = z.object({
  ideas: z.array(z.record(z.string(), z.unknown())).max(200),
  selected: z.array(z.string().max(200)).max(200),
  notes: z.string().max(4000),
  groceryFor: z.array(z.string().max(200)).max(200).optional(),
  grocery: z
    .object({
      listId: z.string().max(80),
      estTotalUsd: num,
      pantryStaplesAssumed: z.array(z.string().max(300)).max(100),
      shoppingTips: z.array(z.string().max(1000)).max(50),
      recipes: z
        .array(
          z.object({
            name: z.string().max(300),
            servings: num,
            ingredients: z.array(z.string().max(500)).max(100),
            steps: z.array(z.string().max(2000)).max(50),
            tip: z.string().max(2000),
            perServing: z.object({ calories: num, proteinG: num, satFatG: num, fiberG: num, carbsG: num, fatG: num }).optional(),
          }),
        )
        .max(30),
    })
    .optional(),
})
