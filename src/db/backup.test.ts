import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { buildBackup, parseBackup, restoreBackup } from './backup'
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
