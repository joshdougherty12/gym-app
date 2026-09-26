import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Meal } from '../types'
import { CutlineDB } from './db'
import { deleteMeal, getApiKey, saveMeal, setApiKey } from './meals'
import { buildBackup } from './backup'

const dbs: CutlineDB[] = []
let n = 0
const fresh = async () => {
  const d = new CutlineDB(`meals-test-${n++}`)
  dbs.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const meal = (id: string, calories: number, proteinG: number, date = '2026-09-25'): Meal => ({
  id,
  date,
  loggedAt: 1,
  mealType: 'lunch',
  name: id,
  items: [],
  calories,
  proteinG,
  source: 'manual',
})

describe('meals', () => {
  it('keeps the day totals equal to the sum of its meals', async () => {
    const d = await fresh()
    await d.dailyLogs.put({ date: '2026-09-25', weightLb: 195, calories: 999 })
    await saveMeal(meal('a', 500, 40), d)
    await saveMeal(meal('b', 300.4, 25.6), d)
    expect(await d.dailyLogs.get('2026-09-25')).toEqual({ date: '2026-09-25', weightLb: 195, calories: 800, proteinG: 66 })
    await deleteMeal('a', d)
    expect((await d.dailyLogs.get('2026-09-25'))?.calories).toBe(300)
    await deleteMeal('b', d)
    expect(await d.dailyLogs.get('2026-09-25')).toEqual({ date: '2026-09-25', weightLb: 195 })
  })

  it('moves totals when a meal changes date', async () => {
    const d = await fresh()
    await saveMeal(meal('a', 500, 40), d)
    await saveMeal(meal('a', 500, 40, '2026-09-24'), d)
    expect((await d.dailyLogs.get('2026-09-24'))?.calories).toBe(500)
    expect((await d.dailyLogs.get('2026-09-25'))?.calories).toBeUndefined()
  })

  it('never puts the API key in a backup', async () => {
    const d = await fresh()
    await setApiKey(' sk-ant-test ', d)
    expect(await getApiKey(d)).toBe('sk-ant-test')
    const json = JSON.stringify(await buildBackup(true, d))
    expect(json).not.toContain('sk-ant-test')
  })
})
