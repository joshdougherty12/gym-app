import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { buildBackup, restoreBackup } from './backup'
import { CutlineDB } from './db'
import { saveAutoSteps, setManualSteps } from './steps'

let n = 0
const dbs: CutlineDB[] = []
async function fresh(): Promise<CutlineDB> {
  const d = new CutlineDB(`steps-${n++}`)
  dbs.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

describe('v6 steps upgrade', () => {
  it('adds the steps table and marks existing step counts as typed in', async () => {
    const name = `upgrade-v6-${n++}`
    const old = new Dexie(name)
    old.version(5).stores({ settings: 'id', dailyLogs: 'date' })
    await old.table('dailyLogs').bulkPut([
      { date: '2026-09-25', steps: 8000, weightLb: 190 },
      { date: '2026-09-26', weightLb: 189 },
    ])
    old.close()

    const d = new CutlineDB(name)
    dbs.push(d)
    await d.open()
    expect(d.verno).toBe(6)
    expect(await d.dailyLogs.get('2026-09-25')).toEqual({ date: '2026-09-25', steps: 8000, weightLb: 190, stepsSource: 'manual' })
    expect(await d.dailyLogs.get('2026-09-26')).toEqual({ date: '2026-09-26', weightLb: 189 })
    expect(await d.steps.count()).toBe(0)
    // An old typed-in value is not replaced by a counted one.
    await saveAutoSteps([{ date: '2026-09-25', steps: 9500 }], 'sensor', d)
    expect((await d.dailyLogs.get('2026-09-25'))?.steps).toBe(8000)
  })
})

describe('counted and imported steps', () => {
  it('fill the check-in, update it, and give way to a typed-in value', async () => {
    const d = await fresh()
    await d.dailyLogs.put({ date: '2026-09-27', weightLb: 188 })
    expect(await saveAutoSteps([{ date: '2026-09-27', steps: 4000 }, { date: '2026-09-26', steps: 11000 }], 'sensor', d)).toBe(2)
    expect(await d.dailyLogs.get('2026-09-27')).toEqual({ date: '2026-09-27', weightLb: 188, steps: 4000, stepsSource: 'sensor' })
    expect((await d.dailyLogs.get('2026-09-26'))?.stepsSource).toBe('sensor')
    expect(await saveAutoSteps([{ date: '2026-09-27', steps: 4000 }], 'sensor', d)).toBe(0)

    await setManualSteps('2026-09-27', 2500, d)
    await saveAutoSteps([{ date: '2026-09-27', steps: 6000 }], 'sensor', d)
    expect(await d.dailyLogs.get('2026-09-27')).toMatchObject({ steps: 2500, stepsSource: 'manual' })
    expect((await d.steps.get('2026-09-27'))?.steps).toBe(6000)

    // Clearing the typed value brings back the counted one.
    await setManualSteps('2026-09-27', undefined, d)
    expect(await d.dailyLogs.get('2026-09-27')).toEqual({ date: '2026-09-27', weightLb: 188, steps: 6000, stepsSource: 'sensor' })
  })

  it('imports from Apple Health with their source and survive a backup round trip', async () => {
    const d = await fresh()
    await saveAutoSteps([{ date: '2026-09-27', steps: 7412 }], 'health-import', d)
    expect((await d.dailyLogs.get('2026-09-27'))?.stepsSource).toBe('health-import')
    const b = await buildBackup(false, d)
    expect(b.steps?.length).toBe(1)
    const e = await fresh()
    await restoreBackup(JSON.parse(JSON.stringify(b)), e)
    expect(await e.steps.get('2026-09-27')).toMatchObject({ steps: 7412, source: 'health-import' })
    expect((await e.dailyLogs.get('2026-09-27'))?.steps).toBe(7412)
  })
})
