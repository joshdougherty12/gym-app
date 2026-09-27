import { useLiveQuery } from 'dexie-react-hooks'
import { newId, timestamp } from '../lib/id'
import { sameRecipe, type RecipeDraft } from '../lib/recipes'
import { markChanged } from '../partner/outbox'
import type { Recipe } from '../types'
import { db as defaultDb, type CutlineDB } from './db'

/** Save a recipe. Saving one with the same name again replaces it instead of adding a copy. */
export async function saveRecipe(r: RecipeDraft, d: CutlineDB = defaultDb): Promise<Recipe> {
  const existing = (await d.recipes.toArray()).find((x) => sameRecipe(x.name, r.name))
  const row: Recipe = { ...r, id: existing?.id ?? newId('recipe'), savedAt: timestamp() }
  await d.recipes.put(row)
  await markChanged('recipe', row.id, d)
  return row
}

export async function deleteRecipe(id: string, d: CutlineDB = defaultDb): Promise<void> {
  await d.recipes.delete(id)
  await markChanged('recipe', id, d)
}

/** Saved recipes, newest first. */
export function useRecipes(): Recipe[] | undefined {
  return useLiveQuery(async () => (await defaultDb.recipes.orderBy('savedAt').toArray()).reverse(), [])
}
