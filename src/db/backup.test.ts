import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { buildBackup, mergeBackup, parseBackup, restoreBackup } from './backup'
import { CutlineDB } from './db'
import { getSettings, updateSettings } from './repo'

const dbs: CutlineDB[] = []
let n = 0
const fresh = () => {
  const d = new CutlineDB(`backup-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

describe('backup', () => {
  it('round-trips everything, photos included, into another database', async () => {
    const a = fresh()
    await a.open()
    await updateSettings({ calorieTarget: 2300 }, a)
    await a.dailyLogs.put({ date: '2026-09-24', weightLb: 195, fatigue: 2 })
    await a.workouts.put({ id: 'w1', date: '2026-09-24', weekNumber: 0, sessionTemplateId: 'push', startedAt: 1, finishedAt: 2, notes: '', sets: [] })
    await a.photos.put({ id: 'p1', date: '2026-09-24', angle: 'front', blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }) })

    const json = JSON.parse(JSON.stringify(await buildBackup(true, a)))
    const b = fresh()
    await b.open()
    await b.dailyLogs.put({ date: '2020-01-01', weightLb: 1 })
    await restoreBackup(parseBackup(json), b)

    expect((await getSettings(b)).calorieTarget).toBe(2300)
    expect(await b.dailyLogs.toArray()).toEqual([{ date: '2026-09-24', weightLb: 195, fatigue: 2 }])
    expect(await b.workouts.count()).toBe(1)
    const photo = await b.photos.get('p1')
    expect(photo?.blob.type).toBe('image/jpeg')
    expect([...new Uint8Array(await photo!.blob.arrayBuffer())]).toEqual([1, 2, 3, 250])
  })

  it('keeps current photos when the backup has none', async () => {
    const a = fresh()
    await a.open()
    const json = JSON.parse(JSON.stringify(await buildBackup(false, a)))
    const b = fresh()
    await b.open()
    await b.photos.put({ id: 'keep', date: '2026-09-24', angle: 'side', blob: new Blob(['x']) })
    await restoreBackup(parseBackup(json), b)
    expect(await b.photos.count()).toBe(1)
  })

  it('rejects files that are not Cutline backups', () => {
    expect(() => parseBackup({ app: 'other' })).toThrow(/not a Cutline backup/)
    expect(() => parseBackup({ app: 'cutline', settings: [] })).toThrow(/missing "exercises"/)
    expect(() => parseBackup(null)).toThrow()
  })
})

describe('backup with meals', () => {
  it('round-trips meals, with their photo only when photos are included', async () => {
    const a = fresh()
    await a.open()
    await a.meals.put({ id: 'm1', date: '2026-09-25', loggedAt: 1, mealType: 'dinner', name: 'Salmon bowl', items: [], calories: 650, proteinG: 45, source: 'photo', photo: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }) })
    const withPhotos = JSON.parse(JSON.stringify(await buildBackup(true, a)))
    const without = JSON.parse(JSON.stringify(await buildBackup(false, a)))
    expect(without.meals[0].photoBase64).toBeUndefined()
    const b = fresh()
    await b.open()
    await restoreBackup(parseBackup(withPhotos), b)
    const m = await b.meals.get('m1')
    expect(m?.calories).toBe(650)
    expect([...new Uint8Array(await m!.photo!.arrayBuffer())]).toEqual([9, 8, 7])
  })
})

describe('merge from backup', () => {
  it('adds the file\'s records and keeps everything already here', async () => {
    const web = fresh()
    await web.open()
    await updateSettings({ startDate: '2026-09-24', calorieTarget: 2400 }, web)
    await web.workouts.put({ id: 'w-web', date: '2026-09-24', weekNumber: 0, sessionTemplateId: 'push', startedAt: 1, finishedAt: 2, notes: '', sets: [] })
    await web.dailyLogs.put({ date: '2026-09-25', weightLb: 195, steps: 8000 })
    const file = JSON.parse(JSON.stringify(await buildBackup(false, web)))

    const app = fresh()
    await app.open()
    await updateSettings({ startDate: '2026-09-25' }, app)
    await app.workouts.put({ id: 'w-app', date: '2026-09-25', weekNumber: 0, sessionTemplateId: 'legs-conditioning', startedAt: 3, finishedAt: 4, notes: '', sets: [] })
    await app.meals.put({ id: 'm1', date: '2026-09-25', loggedAt: 1, mealType: 'lunch', name: 'Bowl', items: [], calories: 600, proteinG: 50, source: 'photo' })
    await app.dailyLogs.put({ date: '2026-09-25', calories: 600, proteinG: 50, steps: 9500 })
    await app.secrets.put({ id: 'anthropic', apiKey: 'sk-ant-keep' })

    await mergeBackup(parseBackup(file), app)

    expect((await app.workouts.toArray()).map((w) => w.id).sort()).toEqual(['w-app', 'w-web'])
    expect((await getSettings(app)).startDate).toBe('2026-09-24')
    expect((await getSettings(app)).calorieTarget).toBe(2400)
    expect(await app.dailyLogs.get('2026-09-25')).toEqual({ date: '2026-09-25', weightLb: 195, steps: 9500, calories: 600, proteinG: 50 })
    expect(await app.meals.count()).toBe(1)
    expect((await app.secrets.get('anthropic'))?.apiKey).toBe('sk-ant-keep')
  })
})
