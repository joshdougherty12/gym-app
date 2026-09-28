import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { buildActivity } from '../lib/activity/finish'
import { recoverWebSession } from '../lib/activity/session'
import { makeTrack } from '../lib/activity/testTrack'
import { METERS_PER_MILE } from '../lib/activity/track'
import { publishActivity, refreshOwnRecords } from '../partner/engine'
import type { ActiveActivity, PartnerLinkRow } from '../types'
import { addSessionEvent, addSessionPoint, clearActiveSession, currentWeightLb, deleteActivity, getActiveSession, putActiveSession, saveActivity, sessionPoints } from './activities'
import { buildBackup, mergeBackup, restoreBackup } from './backup'
import { CutlineDB } from './db'
import { updateSettings } from './repo'

const T0 = 1_700_000_000_000
let n = 0
const dbs: CutlineDB[] = []
async function fresh(): Promise<CutlineDB> {
  const d = new CutlineDB(`act-${n++}`)
  dbs.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const header: ActiveActivity = { id: 'current', activityId: 'act-x', type: 'run', startedAt: T0, source: 'web', events: [], autoPause: true, splitCue: false, splitM: METERS_PER_MILE }

describe('v7 activities upgrade', () => {
  it('adds the activity tables and keeps existing data', async () => {
    const name = `upgrade-v7-${n++}`
    const old = new Dexie(name)
    old.version(6).stores({ settings: 'id', dailyLogs: 'date', cardio: 'id, date, kind', steps: 'date' })
    await old.table('cardio').put({ id: 'c1', date: '2026-09-20', kind: 'zone2', minutes: 30 })
    await old.table('dailyLogs').put({ date: '2026-09-20', weightLb: 190, steps: 8000, stepsSource: 'manual' })
    old.close()

    const d = new CutlineDB(name)
    dbs.push(d)
    await d.open()
    expect(d.verno).toBeGreaterThanOrEqual(7)
    expect(await d.cardio.get('c1')).toEqual({ id: 'c1', date: '2026-09-20', kind: 'zone2', minutes: 30 })
    expect((await d.dailyLogs.get('2026-09-20'))?.weightLb).toBe(190)
    expect(await d.activities.count()).toBe(0)
    expect(await d.activeActivity.count()).toBe(0)
    await d.activityPoints.add({ activityId: 'a', t: 1, lat: 1, lon: 2 })
    expect(await d.activityPoints.where('activityId').equals('a').count()).toBe(1)
  })
})

describe('activity in progress (web) and saving', () => {
  it('survives a reload: stored fixes and pauses rebuild the same session', async () => {
    const d = await fresh()
    await putActiveSession(header, d)
    const pts = makeTrack([{ seconds: 400, speed: 3 }])
    for (const p of pts.slice(0, 200)) await addSessionPoint(header.activityId, p, d)
    await addSessionEvent({ t: T0 + 200_000, kind: 'pause' }, d)
    await addSessionEvent({ t: T0 + 210_000, kind: 'resume' }, d)
    for (const p of pts.slice(210)) await addSessionPoint(header.activityId, p, d)

    // "Reload": read everything back.
    const row = await getActiveSession(d)
    expect(row?.events).toHaveLength(2)
    const back = await sessionPoints(header.activityId, d)
    expect(back).toHaveLength(390)
    expect(back[0]).toEqual(pts[0])
    const s = recoverWebSession(row!, T0 + 400_000)
    const a = buildActivity(s, back, T0 + 400_000, await currentWeightLb(d))
    expect(a.movingMs).toBe(390_000)

    await saveActivity(a, d)
    expect(await d.activities.get('act-x')).toBeDefined()
    expect(await d.cardio.get('act-x')).toMatchObject({ kind: 'run', minutes: 7, activityId: 'act-x' })
    expect(await getActiveSession(d)).toBeUndefined()
    expect(await d.activityPoints.count()).toBe(0)

    await deleteActivity('act-x', d)
    expect(await d.activities.count()).toBe(0)
    expect(await d.cardio.count()).toBe(0)
  })

  it('clears a discarded session', async () => {
    const d = await fresh()
    await putActiveSession(header, d)
    await addSessionPoint('act-x', { t: T0, lat: 40, lon: -75 }, d)
    await clearActiveSession(d)
    expect(await getActiveSession(d)).toBeUndefined()
    expect(await d.activityPoints.count()).toBe(0)
  })

  it('uses the latest logged weight, else the profile weight', async () => {
    const d = await fresh()
    expect(await currentWeightLb(d)).toBeUndefined()
    await updateSettings({ profile: { sex: 'male', age: 40, heightIn: 70, weightLb: 200, goal: 'lose-fat', pace: 'steady', experience: 'some', daysPerWeek: 4, sessionMinutes: 60, equipment: [], limitations: [], limitationNotes: '', dietStyle: 'anything', allergies: [], healthNotes: '', budget: 'moderate', createdAt: 0 } }, d)
    expect(await currentWeightLb(d)).toBe(200)
    await d.dailyLogs.bulkPut([
      { date: '2026-09-01', weightLb: 195 },
      { date: '2026-09-20', weightLb: 190 },
    ])
    expect(await currentWeightLb(d)).toBe(190)
  })
})

describe('backups', () => {
  it('include activities with their routes, restore and merge them', async () => {
    const d = await fresh()
    const a = buildActivity(header, makeTrack([{ seconds: 300, speed: 3 }]), T0 + 300_000, 180)
    await saveActivity(a, d)
    const b = await buildBackup(false, d)
    expect(b.activities).toHaveLength(1)
    expect(b.activities?.[0]?.route.flat().length).toBeGreaterThan(1)
    const json = JSON.parse(JSON.stringify(b))

    const e = await fresh()
    await restoreBackup(json, e)
    expect(await e.activities.get(a.id)).toEqual(a)
    expect(await e.cardio.get(a.id)).toBeDefined()

    const f = await fresh()
    await f.activities.put({ ...a, id: 'other' })
    await mergeBackup(json, f)
    expect(await f.activities.count()).toBe(2)

    // An older backup without activities keeps the ones here.
    const { activities: _drop, ...older } = json
    await restoreBackup(older, e)
    expect(await e.activities.count()).toBe(1)
  })
})

describe('partner activity summary', () => {
  const link: PartnerLinkRow = { id: 'link', householdId: 'h', secret: 's', rootKey: 'k', memberId: 'me', role: 'creator', status: 'linked', createdAt: 0, cursor: 0 }

  it('publishes type, date, distance, time and pace, never coordinates; withdraws when sharing is off', async () => {
    const d = await fresh()
    await d.partner.put(link)
    const a = buildActivity(header, makeTrack([{ seconds: 300, speed: 3 }]), T0 + 300_000, 180)
    await publishActivity(a, d)
    const row = await d.partnerRecords.get(`asum:${a.id}`)
    expect(row?.data).toEqual({ date: a.date, type: 'run', distanceM: Math.round(a.distanceM), movingMs: a.movingMs, avgSpeedMps: a.avgSpeedMps, finishedAt: a.endedAt })
    expect(JSON.stringify(row?.data)).not.toMatch(/lat|lon|route|40\.|-75/)
    expect(await d.syncOutbox.get(`asum:${a.id}`)).toBeDefined()

    await updateSettings({ partner: { name: '', shareWorkouts: true, shareCalorieTarget: true, shareSteps: false, shareActivities: false, shareRoutes: true } }, d)
    await refreshOwnRecords(d)
    expect(await d.partnerRecords.get(`asum:${a.id}`)).toBeUndefined()
    await publishActivity(a, d)
    expect(await d.partnerRecords.get(`asum:${a.id}`)).toBeUndefined()
  })

  it('keeps run summaries and workout summaries on separate switches', async () => {
    const d = await fresh()
    await d.partner.put(link)
    const a = buildActivity(header, makeTrack([{ seconds: 300, speed: 3 }]), T0 + 300_000, 180)
    await updateSettings({ partner: { name: '', shareWorkouts: false, shareCalorieTarget: true, shareSteps: false, shareActivities: true, shareRoutes: true } }, d)
    await refreshOwnRecords(d)
    await publishActivity(a, d)
    expect(await d.partnerRecords.get(`asum:${a.id}`)).toBeDefined()
    const member = await d.partnerRecords.get('member:me')
    expect(member?.data).toMatchObject({ sharesWorkouts: false, sharesActivities: true })
  })
})

describe('partner route sharing', () => {
  const link: PartnerLinkRow = { id: 'link', householdId: 'h', secret: 's', rootKey: 'k', memberId: 'me', role: 'creator', status: 'linked', createdAt: 0, cursor: 0 }
  const recent = () => {
    const now = Date.now()
    return buildActivity({ ...header, startedAt: now - 300_000 }, makeTrack([{ seconds: 300, speed: 3 }], now - 300_000), now, 180)
  }
  const partner = (over: Partial<{ shareActivities: boolean; shareRoutes: boolean }>) => ({
    partner: { name: '', shareWorkouts: true, shareCalorieTarget: true, shareSteps: false, shareActivities: true, shareRoutes: true, ...over },
  })

  it('shares the route only when "Routes and maps" is on, and keeps the summary coordinate-free', async () => {
    const d = await fresh()
    await d.partner.put(link)
    const a = recent()
    await updateSettings(partner({ shareRoutes: false }), d)
    await publishActivity(a, d)
    expect(await d.partnerRecords.get(`asum:${a.id}`)).toBeDefined()
    expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeUndefined()

    await updateSettings(partner({ shareRoutes: true }), d)
    await publishActivity(a, d)
    expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeDefined()
    expect(await d.syncOutbox.get(`aroute:${a.id}`)).toBeDefined()
    expect(JSON.stringify((await d.partnerRecords.get(`asum:${a.id}`))?.data)).not.toMatch(/lat|lon|route|segments|40\.|-75/)
    await refreshOwnRecords(d)
    expect((await d.partnerRecords.get('member:me'))?.data).toMatchObject({ sharesActivities: true, sharesRoutes: true })
  })

  it('withdraws shared routes when route sharing, or activity sharing, is turned off', async () => {
    for (const off of [{ shareRoutes: false }, { shareActivities: false }]) {
      const d = await fresh()
      await d.partner.put(link)
      const a = recent()
      await updateSettings(partner({}), d)
      await publishActivity(a, d)
      expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeDefined()
      await d.syncOutbox.clear()
      await updateSettings(partner(off), d)
      await refreshOwnRecords(d)
      expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeUndefined()
      // The withdrawal is queued to sync, so the partner's phone drops it too.
      expect(await d.syncOutbox.get(`aroute:${a.id}`)).toBeDefined()
      expect((await d.partnerRecords.get('member:me'))?.data).toMatchObject({ sharesRoutes: false })
    }
  })

  it('never shares routes older than 30 days, and withdraws a shared route once it expires', async () => {
    const d = await fresh()
    await d.partner.put(link)
    await updateSettings(partner({}), d)
    const old = { ...recent(), id: 'old', startedAt: Date.now() - 31 * 86_400_000 }
    await publishActivity(old, d)
    expect(await d.partnerRecords.get('asum:old')).toBeDefined()
    expect(await d.partnerRecords.get('aroute:old')).toBeUndefined()

    const a = recent()
    await publishActivity(a, d)
    const row = await d.partnerRecords.get(`aroute:${a.id}`)
    if (!row) throw new Error('route not shared')
    // Age the shared route past 30 days: the next refresh withdraws it and keeps the summary.
    await d.partnerRecords.put({ ...row, data: { ...(row.data as object), startedAt: Date.now() - 31 * 86_400_000 } })
    await refreshOwnRecords(d)
    expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeUndefined()
    expect(await d.partnerRecords.get(`asum:${a.id}`)).toBeDefined()
  })

  it('withdraws the route with the summary when the activity is deleted', async () => {
    const d = await fresh()
    await d.partner.put(link)
    await updateSettings(partner({}), d)
    const a = recent()
    await saveActivity(a, d)
    expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeDefined()
    await deleteActivity(a.id, d)
    expect(await d.partnerRecords.get(`aroute:${a.id}`)).toBeUndefined()
    expect(await d.partnerRecords.get(`asum:${a.id}`)).toBeUndefined()
  })
})
