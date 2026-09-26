import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import type { MealType, Settings } from '../../types'
import { GroceryPlanSchema, MealEstimateSchema, MealIdeasSchema, WeekIdeasSchema, type GroceryPlan, type MealEstimate, type MealIdea, type WeekIdea } from './schemas'

export const MODEL = 'claude-opus-5'

/** Raised with a message that can be shown to the user as-is. */
export class AiError extends Error {}

function client(apiKey: string): Anthropic {
  // Runs on the user's own phone with the user's own key, stored only on the device.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })
}

type Profile = Pick<Settings, 'calorieTarget' | 'proteinTargetG' | 'foodNotes' | 'householdSize' | 'satFatLimitG' | 'fiberTargetG' | 'goal'>

function systemPrompt(p: Profile): string {
  return [
    'You are the nutrition helper inside Cutline, a personal training and fat-loss app.',
    `The user is a 26-year-old man, about 195 lb, 6'1", lifting 5 days a week, currently ${p.goal === 'cut' ? 'cutting (losing fat while keeping strength)' : 'on a small surplus'}.`,
    `Daily targets: ${p.calorieTarget} kcal, ${p.proteinTargetG} g protein, saturated fat under ${p.satFatLimitG} g, fiber ${p.fiberTargetG} g or more.`,
    `Dietary notes from the user: ${p.foodNotes || 'none'}`,
    'Keep suggestions budget-friendly (US grocery prices), realistic for a home cook, and heart-healthy. Estimates are fine; be honest about uncertainty. Never give medical advice beyond general healthy-eating guidance.',
  ].join('\n')
}

/**
 * One structured request. Uses Claude Opus 5 with server-side fallbacks, so a
 * declined request is retried on Anthropic's recommended fallback model.
 */
async function ask<S extends z.ZodType>(apiKey: string, p: Profile, schema: S, content: Anthropic.Beta.BetaContentBlockParam[], effort: 'medium' | 'high'): Promise<z.infer<S>> {
  let res
  try {
    res = await client(apiKey).beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system: systemPrompt(p),
      messages: [{ role: 'user', content }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Your API key was rejected. Check it in Settings → Meal AI.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('This API key is not allowed to use Claude. Check your Anthropic console.')
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Too many requests right now, or your API credit ran out. Try again in a minute, or add credit in the Anthropic console.')
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('No connection. Check your signal and try again.')
    if (e instanceof Anthropic.APIError) throw new AiError(`Claude had a problem (${e.status ?? 'error'}). Try again.`)
    throw new AiError('Something went wrong reaching Claude. Try again.')
  }
  if (res.stop_reason === 'refusal') throw new AiError('Claude could not help with that one. Try a different photo or request.')
  if (res.stop_reason === 'max_tokens') throw new AiError('The answer was cut off. Try again.')
  if (!res.parsed_output) throw new AiError('Claude returned something unreadable. Try again.')
  return res.parsed_output as z.infer<S>
}

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Estimate a meal from a photo (JPEG). `note` is optional context from the user. */
export async function estimateMeal(apiKey: string, p: Profile, photo: Blob, note: string): Promise<MealEstimate> {
  const data = await blobToBase64(photo)
  return ask(
    apiKey,
    p,
    MealEstimateSchema,
    [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
      {
        type: 'text',
        text: [
          'Estimate what is in this meal photo: each item with a portion, calories, protein, saturated fat and fiber, then totals (also carbs and fat).',
          'Assume typical cooking oil or sauce if it looks cooked in it, and say so. Use the plate, utensils or hands for scale.',
          note ? `The user adds: ${note}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    'medium',
  )
}

export interface DaySoFar {
  mealType: MealType
  eatenCalories: number
  eatenProteinG: number
  eatenSatFatG: number
  eatenFiberG: number
  mealsEaten: string[]
  avoid: string[]
}

/** Three budget-friendly ideas for the next meal that fit what is left today. */
export async function suggestMeals(apiKey: string, p: Profile, d: DaySoFar): Promise<MealIdea[]> {
  const left = (t: number, e: number) => Math.max(0, Math.round(t - e))
  const r = await ask(
    apiKey,
    p,
    MealIdeasSchema,
    [
      {
        type: 'text',
        text: [
          `Suggest 3 different ${d.mealType} ideas for today.`,
          `Eaten so far today: ${Math.round(d.eatenCalories)} kcal, ${Math.round(d.eatenProteinG)} g protein, ${Math.round(d.eatenSatFatG)} g saturated fat, ${Math.round(d.eatenFiberG)} g fiber${d.mealsEaten.length ? ` (${d.mealsEaten.join('; ')})` : ''}.`,
          `Left for the day: about ${left(p.calorieTarget, d.eatenCalories)} kcal and ${left(p.proteinTargetG, d.eatenProteinG)} g protein; saturated fat room ${left(p.satFatLimitG, d.eatenSatFatG)} g.`,
          'Size each idea as one sensible meal (not the whole remainder unless it is dinner). High protein, low saturated fat, some fiber. Cheap, common ingredients, quick to make.',
          d.avoid.length ? `Do not repeat these: ${d.avoid.join('; ')}.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    'medium',
  )
  return r.ideas.slice(0, 3)
}

/** About ten dinner ideas for the week to choose from. */
export async function weekIdeas(apiKey: string, p: Profile, opts: { count: number; avoid: string[] }): Promise<WeekIdea[]> {
  const r = await ask(
    apiKey,
    p,
    WeekIdeasSchema,
    [
      {
        type: 'text',
        text: [
          `Propose ${opts.count} dinner ideas for this week for a household of ${p.householdSize}. His wife loves cooking and wants fresh ideas, so make them varied and interesting (different cuisines and techniques) but still budget-friendly and weeknight-realistic.`,
          `Each dinner per serving should fit a cut: roughly 550-800 kcal, 40 g+ protein, low saturated fat (under ${Math.round(p.satFatLimitG / 2)} g), good fiber. Heart-healthy for high cholesterol.`,
          'Prefer ideas that share ingredients so the grocery list stays short and cheap, and mark which make good leftovers for lunch.',
          opts.avoid.length ? `Avoid repeating: ${opts.avoid.join('; ')}.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    'high',
  )
  return r.meals
}

/** One combined grocery list and recipes for the chosen dinners. */
export async function groceryPlan(apiKey: string, p: Profile, chosen: WeekIdea[], extraNotes: string): Promise<GroceryPlan> {
  return ask(
    apiKey,
    p,
    GroceryPlanSchema,
    [
      {
        type: 'text',
        text: [
          `Build one grocery list for these ${chosen.length} dinners for ${p.householdSize} people, plus leftovers where marked:`,
          ...chosen.map((m, i) => `${i + 1}. ${m.name}: ${m.description}${m.leftoversForLunch ? ' (make extra for lunch)' : ''}`),
          'Combine quantities across recipes, group by store section, give a rough US price for each line and a total. Assume basic pantry staples (list the ones you assumed) and do not put them on the list.',
          'Then write each recipe for a home cook who enjoys cooking: servings, ingredient amounts, clear steps, and one tip. Keep them heart-healthy (low saturated fat).',
          extraNotes ? `Extra notes from the user: ${extraNotes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    'high',
  )
}
