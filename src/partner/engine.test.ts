import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { CutlineDB } from '../db/db'
import { setGroceryList, setItemChecked, getWeekPlan, saveWeekPlan } from '../db/kitchen'
import { deleteRecipe, saveRecipe } from '../db/recipes'
import { updateSettings } from '../db/repo'
import { createHousehold, joinHousehold, LinkError, publishWorkout, sendEvent, syncOnce, unlink } from './engine'
import { FakeServer } from './fakeServer'
import { markChanged } from './outbox'

let n = 0
const dbs: CutlineDB[] = []
async function phone(): Promise<CutlineDB> {
  const d = new CutlineDB(`engine-${n++}`)
  dbs.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const grocery = {
  sections: [{ name: 'Produce', items: [{ item: 'Spinach', quantity: '1 bag', estCostUsd: 3, forMeals: [] }, { item: 'Lemons', quantity: '2', estCostUsd: 1, forMeals: [] }] }],
  estTotalUsd: 4,
  pantryStaplesAssumed: [],
  recipes: [],
  shoppingTips: [],
}
const recipe = (name: string) => ({ name, servings: 4, ingredients: ['x'], steps: ['y'], calories: 500, proteinG: 40 })

async function linkedPair() {
  const server = new FakeServer()
  const deps = server.deps()
  const a = await phone()
  const b = await phone()
  await updateSettings({ partner: { name: 'Josh', shareWorkouts: true, shareCalorieTarget: true }, calorieTarget: 2400 }, a)
  await updateSettings({ partner: { name: 'Sam', shareWorkouts: true, shareCalorieTarget: true }, calorieTarget: 1600 }, b)
  const code = await createHousehold(a, deps)
  await joinHousehold(code, b, deps)
  const sync = async () => {
    await syncOnce(a, deps)
    await syncOnce(b, deps)
    await syncOnce(a, deps)
  }
  await sync()
  return { server, deps, a, b, sync }
}

describe('linking', () => {
  it('links two phones; the second takes the household kitchen and adds its recipes', async () => {
    const server = new FakeServer()
    const deps = server.deps()
    const a = await phone()
    const b = await phone()
    await saveRecipe(recipe('Chili'), a)
    await saveWeekPlan({ ideas: [], selected: [], notes: 'from A' }, a)
    await saveRecipe(recipe('Tacos'), b)
    await saveRecipe(recipe('chili'), b) // same dish saved on both phones
    await saveWeekPlan({ ideas: [], selected: [], notes: 'from B' }, b)

    const code = await createHousehold(a, deps)
    expect((await a.partner.get('link'))?.status).toBe('waiting')
    await syncOnce(a, deps)
    await joinHousehold(code, b, deps)
    await syncOnce(b, deps)
    await syncOnce(a, deps)

    expect((await a.partner.get('link'))?.status).toBe('linked')
    expect((await getWeekPlan(b)).notes).toBe('from A')
    const names = async (d: CutlineDB) => (await d.recipes.toArray()).map((r) => r.name).sort()
    expect(await names(a)).toEqual(['Chili', 'Tacos'])
    expect(await names(b)).toEqual(['Chili', 'Tacos'])
    // Each sees the other's profile.
    expect(await a.partnerRecords.where('type').equals('member').count()).toBe(2)
    expect(await b.partnerRecords.where('type').equals('member').count()).toBe(2)
  })

  it('refuses a third phone and a second link', async () => {
    const { server, a } = await linkedPair()
    const code = (await import('./engine')).linkCodeFor((await a.partner.get('link'))!)
    const c = await phone()
    await expect(joinHousehold(code, c, server.deps())).rejects.toThrow(/two people/)
    await expect(createHousehold(a, server.deps())).rejects.toBeInstanceOf(LinkError)
  })

  it('shares names and calorie targets, and stops sharing the target when turned off', async () => {
    const { a, b, sync } = await linkedPair()
    const theirs = async (d: CutlineDB) => {
      const me = (await d.partner.get('link'))?.memberId
      return (await d.partnerRecords.where('type').equals('member').toArray()).find((r) => r.by !== me)?.data
    }
    expect(await theirs(a)).toEqual({ name: 'Sam', sharesWorkouts: true, calorieTarget: 1600 })
    expect(await theirs(b)).toEqual({ name: 'Josh', sharesWorkouts: true, calorieTarget: 2400 })
    await updateSettings({ partner: { name: 'Sam', shareWorkouts: true, shareCalorieTarget: false } }, b)
    await sync()
    expect(await theirs(a)).toEqual({ name: 'Sam', sharesWorkouts: true })
  })
})

describe('shared kitchen', () => {
  it('syncs the grocery list and merges check-offs item by item', async () => {
    const { a, b, sync } = await linkedPair()
    await setGroceryList(await getWeekPlan(a), grocery, a)
    await sync()
    const items = async (d: CutlineDB) => (await d.groceryItems.toArray()).sort((x, y) => x.order - y.order).map((i) => `${i.item}:${i.checked ? 'x' : ' '}`)
    expect(await items(b)).toEqual(['Spinach: ', 'Lemons: '])
    const [spinach, lemons] = (await b.groceryItems.toArray()).sort((x, y) => x.order - y.order)
    // Both check off different items at the store before either syncs.
    await setItemChecked(spinach!.id, true, b)
    await setItemChecked(lemons!.id, true, a)
    await sync()
    expect(await items(a)).toEqual(['Spinach:x', 'Lemons:x'])
    expect(await items(b)).toEqual(['Spinach:x', 'Lemons:x'])
  })

  it('last writer wins on the same item', async () => {
    const { a, b, sync } = await linkedPair()
    await setGroceryList(await getWeekPlan(a), grocery, a)
    await sync()
    const id = (await a.groceryItems.toArray())[0]!.id
    await setItemChecked(id, true, a)
    await new Promise((r) => setTimeout(r, 5))
    await setItemChecked(id, false, b) // later edit
    await sync()
    expect((await a.groceryItems.get(id))?.checked).toBe(false)
    expect((await b.groceryItems.get(id))?.checked).toBe(false)
  })

  it('deletions travel as tombstones; a rebuilt list replaces the old one', async () => {
    const { a, b, sync } = await linkedPair()
    const r = await saveRecipe(recipe('Soup'), a)
    await setGroceryList(await getWeekPlan(a), grocery, a)
    await sync()
    expect(await b.recipes.get(r.id)).toBeDefined()
    await deleteRecipe(r.id, b)
    await setGroceryList(await getWeekPlan(b), { ...grocery, sections: [{ name: 'Dairy', items: [{ item: 'Yogurt', quantity: '1 tub', estCostUsd: 4, forMeals: [] }] }] }, b)
    await sync()
    expect(await a.recipes.get(r.id)).toBeUndefined()
    expect((await a.groceryItems.toArray()).map((i) => i.item)).toEqual(['Yogurt'])
    expect((await getWeekPlan(a)).grocery?.listId).toBe((await getWeekPlan(b)).grocery?.listId)
  })

  it('keeps changes made offline and sends them when back online', async () => {
    const { server, a, b, deps } = await linkedPair()
    server.offline = true
    await saveRecipe(recipe('Offline curry'), a)
    const res = await syncOnce(a, deps)
    expect(res.state).toBe('offline')
    const [entry] = await a.syncOutbox.toArray()
    expect(entry?.attempts).toBe(1)
    expect(entry?.nextAttemptAt).toBeGreaterThan(Date.now())
    server.offline = false
    // Not due yet: nothing is sent.
    await syncOnce(a, deps)
    expect(await a.syncOutbox.count()).toBe(1)
    await a.syncOutbox.update(entry!.key, { nextAttemptAt: 0 })
    expect((await syncOnce(a, deps)).state).toBe('synced')
    expect(await a.syncOutbox.count()).toBe(0)
    await syncOnce(b, deps)
    expect((await b.recipes.toArray()).map((x) => x.name)).toContain('Offline curry')
  })

  it('stores only ciphertext on the server', async () => {
    const { server, a, sync } = await linkedPair()
    await saveRecipe(recipe('Secret family lasagna'), a)
    await sync()
    const dump = JSON.stringify([...server.houses.values()].map((h) => [...h.rows.values()]))
    expect(dump).not.toMatch(/lasagna|Josh|Sam|2400|recipe|grocery/i)
  })
})

describe('workouts and events', () => {
  it('shares a workout summary, withdraws it when sharing is turned off, and never shares bodyweight', async () => {
    const { a, b, sync } = await linkedPair()
    await a.dailyLogs.put({ date: '2026-09-24', weightLb: 201.4 })
    const log = { id: 'w1', date: '2026-09-24', weekNumber: 1, sessionTemplateId: 'upper-heavy', startedAt: 1000, finishedAt: 1000 + 45 * 60_000, notes: '', sets: [{ slotId: 's', exerciseId: 'bench-press', setIndex: 0, weightLb: 185, reps: 8, rir: 2, isWarmup: false, loggedAt: 1 }] }
    await a.workouts.put(log)
    await publishWorkout(log, a)
    await sync()
    const wsum = await b.partnerRecords.where('type').equals('wsum').toArray()
    expect(wsum).toHaveLength(1)
    expect(wsum[0]?.data).toMatchObject({ minutes: 45, setsDone: 1 })
    expect(JSON.stringify(wsum[0]?.data)).not.toContain('201.4')
    await updateSettings({ partner: { name: 'Josh', shareWorkouts: false, shareCalorieTarget: true } }, a)
    await sync()
    expect(await b.partnerRecords.where('type').equals('wsum').count()).toBe(0)
  })

  it('delivers a high-five once', async () => {
    const { a, b, deps } = await linkedPair()
    expect(await sendEvent({ kind: 'highfive', at: Date.now() }, b)).toBe(true)
    await syncOnce(b, deps)
    const first = await syncOnce(a, deps)
    expect(first.newEvents.map((e) => (e.data as { kind: string }).kind)).toEqual(['highfive'])
    const second = await syncOnce(a, deps)
    expect(second.newEvents).toEqual([])
  })
})

describe('unlinking', () => {
  it('stops sharing on both phones and each keeps its own data', async () => {
    const { a, b, deps } = await linkedPair()
    await saveRecipe(recipe('Keep me'), a)
    await syncOnce(a, deps)
    await syncOnce(b, deps)
    await unlink(a, deps)
    expect(await a.partner.count()).toBe(0)
    expect((await a.recipes.toArray()).map((r) => r.name)).toContain('Keep me')
    const res = await syncOnce(b, deps)
    expect(res.state).toBe('gone')
    expect(await b.partner.count()).toBe(0)
    expect(await b.partnerRecords.count()).toBe(0)
    expect((await b.recipes.toArray()).map((r) => r.name)).toContain('Keep me')
    // Edits after unlinking are not queued.
    await markChanged('recipe', 'anything', b)
    expect(await b.syncOutbox.count()).toBe(0)
  })
})
