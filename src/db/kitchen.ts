import { useLiveQuery } from 'dexie-react-hooks'
import type { GroceryPlan } from '../lib/ai/schemas'
import { newId } from '../lib/id'
import { EMPTY_PLAN, groceryHeader, groceryItemsFromPlan, splitLegacyPlan, type WeekPlan } from '../lib/kitchen'
import { markChanged } from '../partner/outbox'
import type { GroceryItem } from '../types'
import { db as defaultDb, WEEKPLAN_ID, type CutlineDB } from './db'

// The shared kitchen: the week plan and its grocery list. Every change is
// marked for partner sync (a no-op when not linked).

function asPlan(data: unknown): WeekPlan {
  return { ...EMPTY_PLAN, ...(data as Partial<WeekPlan> | undefined) }
}

export async function getWeekPlan(d: CutlineDB = defaultDb): Promise<WeekPlan> {
  return asPlan((await d.aiCache.get(WEEKPLAN_ID))?.data)
}

export async function saveWeekPlan(plan: WeekPlan, d: CutlineDB = defaultDb): Promise<void> {
  await d.aiCache.put({ id: WEEKPLAN_ID, createdAt: Date.now(), data: plan })
  await markChanged('plan', 'current', d)
}

/** Replace the grocery list: old items are deleted, the new ones start unchecked. */
export async function setGroceryList(plan: WeekPlan, g: GroceryPlan, d: CutlineDB = defaultDb): Promise<void> {
  const listId = newId('list')
  const items = groceryItemsFromPlan(g, listId, () => newId('gi'))
  const next: WeekPlan = { ...plan, grocery: groceryHeader(g, listId), groceryFor: [...plan.selected] }
  // Items and plan change together, so a sync never sees items without their list.
  const old = await d.transaction('rw', d.groceryItems, d.aiCache, async () => {
    const keys = await d.groceryItems.toCollection().primaryKeys()
    await d.groceryItems.clear()
    await d.groceryItems.bulkPut(items)
    await d.aiCache.put({ id: WEEKPLAN_ID, createdAt: Date.now(), data: next })
    return keys
  })
  await markChanged('plan', 'current', d)
  await markChanged('grocery', [...old, ...items.map((i) => i.id)], d)
}

/** Start a new week: clear ideas, picks and the list (notes are kept). */
export async function startNewWeek(notes: string, d: CutlineDB = defaultDb): Promise<void> {
  const old = await d.transaction('rw', d.groceryItems, d.aiCache, async () => {
    const keys = await d.groceryItems.toCollection().primaryKeys()
    await d.groceryItems.clear()
    await d.aiCache.put({ id: WEEKPLAN_ID, createdAt: Date.now(), data: { ...EMPTY_PLAN, notes } })
    return keys
  })
  await markChanged('plan', 'current', d)
  await markChanged('grocery', old, d)
}

export async function setItemChecked(id: string, checked: boolean, d: CutlineDB = defaultDb): Promise<void> {
  const n = await d.groceryItems.update(id, { checked })
  if (n) await markChanged('grocery', id, d)
}

/** Convert a week plan restored from an older backup to the item-per-row list. */
export async function upgradeLegacyWeekPlan(d: CutlineDB = defaultDb): Promise<void> {
  const row = await d.aiCache.get(WEEKPLAN_ID)
  if (!row) return
  const listId = newId('list')
  const split = splitLegacyPlan(row.data, listId, (n) => `${listId}-${n}`)
  if (!split) return
  await d.transaction('rw', d.aiCache, d.groceryItems, async () => {
    await d.groceryItems.clear()
    await d.groceryItems.bulkPut(split.items)
    await d.aiCache.put({ ...row, data: split.plan })
  })
}

export function useWeekPlan(): { plan: WeekPlan; loaded: boolean } {
  const row = useLiveQuery(async () => (await defaultDb.aiCache.get(WEEKPLAN_ID)) ?? null, [])
  return { plan: asPlan(row?.data), loaded: row !== undefined }
}

/** Items of the current list, in order. */
export function useGroceryItems(listId: string | undefined): GroceryItem[] | undefined {
  return useLiveQuery(async () => (listId ? (await defaultDb.groceryItems.where('listId').equals(listId).toArray()).sort((a, b) => a.order - b.order) : []), [listId])
}
