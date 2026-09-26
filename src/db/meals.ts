import { useLiveQuery } from 'dexie-react-hooks'
import { sumMeals } from '../lib/meals'
import type { DailyLog, Meal } from '../types'
import { db as defaultDb, type CutlineDB } from './db'

/**
 * Days with logged meals get their calorie and protein totals from the meals,
 * so the weekly review, nutrition card and charts all see them. A day with no
 * meals keeps whatever was typed into the check-in.
 */
export async function syncDayFromMeals(date: string, d: CutlineDB = defaultDb): Promise<void> {
  await d.transaction('rw', d.meals, d.dailyLogs, async () => {
    const meals = await d.meals.where('date').equals(date).toArray()
    const cur: DailyLog = (await d.dailyLogs.get(date)) ?? { date }
    if (meals.length === 0) return
    const t = sumMeals(meals)
    await d.dailyLogs.put({ ...cur, calories: Math.round(t.calories), proteinG: Math.round(t.proteinG) })
  })
}

export async function saveMeal(m: Meal, d: CutlineDB = defaultDb): Promise<void> {
  const before = await d.meals.get(m.id)
  await d.meals.put(m)
  await syncDayFromMeals(m.date, d)
  if (before && before.date !== m.date) await afterRemoval(before.date, d)
}

async function afterRemoval(date: string, d: CutlineDB) {
  const left = await d.meals.where('date').equals(date).count()
  if (left > 0) return syncDayFromMeals(date, d)
  // Last meal of the day removed: clear the meal-derived totals.
  const cur = await d.dailyLogs.get(date)
  if (!cur) return
  const { calories: _c, proteinG: _p, ...rest } = cur
  await d.dailyLogs.put(rest)
}

export async function deleteMeal(id: string, d: CutlineDB = defaultDb): Promise<void> {
  const m = await d.meals.get(id)
  if (!m) return
  await d.meals.delete(id)
  await afterRemoval(m.date, d)
}

export function useMealsForDate(date: string): Meal[] | undefined {
  return useLiveQuery(async () => (await defaultDb.meals.where('date').equals(date).toArray()).sort((a, b) => a.loggedAt - b.loggedAt), [date])
}

export async function getApiKey(d: CutlineDB = defaultDb): Promise<string | undefined> {
  return (await d.secrets.get('anthropic'))?.apiKey || undefined
}

export async function setApiKey(key: string, d: CutlineDB = defaultDb): Promise<void> {
  if (key.trim()) await d.secrets.put({ id: 'anthropic', apiKey: key.trim() })
  else await d.secrets.delete('anthropic')
}

export function useHasApiKey(): boolean | undefined {
  return useLiveQuery(async () => !!(await getApiKey()), [])
}

export async function getCache<T>(id: string, d: CutlineDB = defaultDb): Promise<T | undefined> {
  return (await d.aiCache.get(id))?.data as T | undefined
}

export async function setCache(id: string, data: unknown, d: CutlineDB = defaultDb): Promise<void> {
  await d.aiCache.put({ id, createdAt: Date.now(), data })
}

export function useCache<T>(id: string): { data: T | undefined; loaded: boolean } {
  const row = useLiveQuery(async () => (await defaultDb.aiCache.get(id)) ?? null, [id])
  return { data: row ? (row.data as T) : undefined, loaded: row !== undefined }
}
