import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { APP_NAME } from '../lib/brand'
import { cardioFor } from '../lib/activity/finish'
import { gpxFileName, toGpx } from '../lib/activity/gpx'
import { isNative } from '../lib/native'
import { publishActivity, withdrawActivity } from '../partner/engine'
import type { ActiveActivity, Activity, ActivityPointRow, TrackEvent, TrackPoint } from '../types'
import { db as defaultDb, type CutlineDB } from './db'
import { getSettings } from './repo'

/** Latest logged body weight, else the weight given at setup (for calories). */
export async function currentWeightLb(d: CutlineDB = defaultDb): Promise<number | undefined> {
  const logged = (await d.dailyLogs.orderBy('date').reverse().filter((x) => x.weightLb !== undefined).first())?.weightLb
  if (logged) return logged
  return (await getSettings(d)).profile?.weightLb
}

/**
 * Save a finished activity, add (or update) its cardio entry, and clear the
 * in-progress session, all in one transaction. Then share its summary with
 * the partner if that is on.
 */
export async function saveActivity(a: Activity, d: CutlineDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.activities, d.cardio, d.activeActivity, d.activityPoints], async () => {
    await d.activities.put(a)
    await d.cardio.put(cardioFor(a))
    const cur = await d.activeActivity.get('current')
    if (cur?.activityId === a.id) await d.activeActivity.delete('current')
    await d.activityPoints.where('activityId').equals(a.id).delete()
  })
  await publishActivity(a, d).catch(() => undefined)
}

/** Delete an activity, its cardio entry and its shared summary. */
export async function deleteActivity(id: string, d: CutlineDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.activities, d.cardio], async () => {
    await d.activities.delete(id)
    await d.cardio.delete(id)
    await d.cardio.filter((c) => c.activityId === id).delete()
  })
  await withdrawActivity(id, d).catch(() => undefined)
}

// ---- The session in progress (web: fixes stored row by row; Android: header only, fixes live natively) ----

export async function getActiveSession(d: CutlineDB = defaultDb): Promise<ActiveActivity | undefined> {
  return d.activeActivity.get('current')
}

export async function putActiveSession(s: ActiveActivity, d: CutlineDB = defaultDb): Promise<void> {
  await d.activeActivity.put(s)
}

export async function addSessionEvent(e: TrackEvent, d: CutlineDB = defaultDb): Promise<ActiveActivity | undefined> {
  return d.transaction('rw', d.activeActivity, async () => {
    const cur = await d.activeActivity.get('current')
    if (!cur) return undefined
    const next = { ...cur, events: [...cur.events, e] }
    await d.activeActivity.put(next)
    return next
  })
}

export async function addSessionPoint(activityId: string, p: TrackPoint, d: CutlineDB = defaultDb): Promise<void> {
  await d.activityPoints.add({ activityId, ...p })
}

export async function sessionPoints(activityId: string, d: CutlineDB = defaultDb): Promise<TrackPoint[]> {
  const rows: ActivityPointRow[] = await d.activityPoints.where('activityId').equals(activityId).sortBy('id')
  return rows.map(({ id: _id, activityId: _a, ...p }) => p)
}

export async function clearActiveSession(d: CutlineDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.activeActivity, d.activityPoints], async () => {
    await d.activeActivity.delete('current')
    await d.activityPoints.clear()
  })
}

// ---- Export ----

/** Share or download the activity as GPX 1.1. */
export async function exportGpx(a: Activity): Promise<'shared' | 'downloaded' | 'failed'> {
  const text = toGpx(a, APP_NAME)
  const name = gpxFileName(a)
  try {
    if (isNative()) {
      const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: name, files: [res.uri], dialogTitle: 'Export GPX' })
      return 'shared'
    }
    const file = new File([text], name, { type: 'application/gpx+xml' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        return 'shared'
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'failed'
      }
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
