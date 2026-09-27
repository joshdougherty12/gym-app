import type { GroceryPlan, WeekIdea } from './ai/schemas'
import type { SharedGroceryHeader } from './partner/types'
import type { GroceryItem } from '../types'

/**
 * The week plan: dinner ideas, the ones picked, notes, and the grocery list's
 * header. The list's items are separate rows (GroceryItem), so two people
 * checking items off at the store merge item by item.
 */
export interface WeekPlan {
  ideas: WeekIdea[]
  selected: string[]
  notes: string
  grocery?: SharedGroceryHeader
  groceryFor?: string[]
}

export const EMPTY_PLAN: WeekPlan = { ideas: [], selected: [], notes: '' }

/** Grocery rows for a freshly built list. */
export function groceryItemsFromPlan(g: Pick<GroceryPlan, 'sections'>, listId: string, makeId: (n: number) => string, checked: ReadonlySet<string> = new Set()): GroceryItem[] {
  const out: GroceryItem[] = []
  for (const s of g.sections) {
    for (const it of s.items) {
      out.push({
        id: makeId(out.length),
        listId,
        section: s.name,
        item: it.item,
        quantity: it.quantity,
        estCostUsd: it.estCostUsd,
        order: out.length,
        checked: checked.has(`${s.name}|${it.item}`),
      })
    }
  }
  return out
}

/** The list header kept on the plan (everything but the items). */
export function groceryHeader(g: GroceryPlan, listId: string): SharedGroceryHeader {
  return { listId, estTotalUsd: g.estTotalUsd, pantryStaplesAssumed: [...g.pantryStaplesAssumed], shoppingTips: [...g.shoppingTips], recipes: structuredClone(g.recipes) }
}

/** Items grouped by store section, in list order. */
export function groupBySection(items: readonly GroceryItem[]): { name: string; items: GroceryItem[] }[] {
  const out: { name: string; items: GroceryItem[] }[] = []
  for (const it of [...items].sort((a, b) => a.order - b.order)) {
    let s = out.find((x) => x.name === it.section)
    if (!s) {
      s = { name: it.section, items: [] }
      out.push(s)
    }
    s.items.push(it)
  }
  return out
}

interface LegacyPlan {
  ideas?: WeekIdea[]
  selected?: string[]
  notes?: string
  grocery?: GroceryPlan
  groceryFor?: string[]
  checked?: string[]
}

/**
 * Plans saved before 1.8 kept the whole grocery list (and what was checked)
 * inside the plan. Split one into the new plan and its item rows; null if it
 * is already in the new shape.
 */
export function splitLegacyPlan(data: unknown, listId: string, makeId: (n: number) => string): { plan: WeekPlan; items: GroceryItem[] } | null {
  if (typeof data !== 'object' || data === null) return null
  const old = data as LegacyPlan
  const legacyGrocery = old.grocery && Array.isArray((old.grocery as { sections?: unknown }).sections)
  if (!legacyGrocery && !Array.isArray(old.checked)) return null
  const plan: WeekPlan = { ideas: old.ideas ?? [], selected: old.selected ?? [], notes: old.notes ?? '', ...(old.groceryFor ? { groceryFor: old.groceryFor } : {}) }
  if (!legacyGrocery || !old.grocery) return { plan, items: [] }
  plan.grocery = groceryHeader(old.grocery, listId)
  return { plan, items: groceryItemsFromPlan(old.grocery, listId, makeId, new Set(old.checked ?? [])) }
}
