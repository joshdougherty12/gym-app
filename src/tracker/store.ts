import { LocalNotifications } from '@capacitor/local-notifications'
import { create } from 'zustand'
import { addSessionEvent, addSessionPoint, clearActiveSession, currentWeightLb, getActiveSession, putActiveSession, saveActivity, sessionPoints } from '../db/activities'
import { buildActivity } from '../lib/activity/finish'
import { distUnit, splitMeters } from '../lib/activity/format'
import { nativeRecovery, recoverWebSession, sessionFromNative, withEvent } from '../lib/activity/session'
import { ACTIVITY, isPausedAt } from '../lib/activity/track'
import { newId } from '../lib/id'
import { isNative } from '../lib/native'
import type { ActiveActivity, ActivityType, TrackPoint, Units } from '../types'
import { ActivityTracker, type NativeSession } from './native'

// The activity in progress, for both platforms:
// - Android: a foreground service records GPS natively (screen off, app in the
//   background); this store pulls its fixes while the app is open.
// - Web / iPhone: navigator.geolocation while the page is open; every fix is
//   written to IndexedDB so a reload resumes.

export type TrackerErrorCode = 'denied' | 'precise' | 'gps-off' | 'unsupported' | 'failed'

export class TrackerError extends Error {
  readonly code: TrackerErrorCode
  constructor(code: TrackerErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface TrackerState {
  loaded: boolean
  session: ActiveActivity | null
  points: TrackPoint[]
  /** Web: a geolocation problem to show (blocked, unavailable). */
  gpsError: string | null
  load: () => Promise<void>
  start: (o: { type: ActivityType; autoPause: boolean; splitCue: boolean; units: Units }) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  /** Save the activity; returns its id. */
  finish: () => Promise<string | null>
  discard: () => Promise<void>
  /** Android: pull new fixes and the pause state (the notification can pause too). */
  poll: () => Promise<void>
}

// ---- Web geolocation ----

let watchId: number | null = null

function stopWatch() {
  if (watchId !== null) navigator.geolocation?.clearWatch(watchId)
  watchId = null
}

function startWatch() {
  if (watchId !== null || typeof navigator === 'undefined' || !navigator.geolocation) return
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const s = useTracker.getState().session
      const t = Date.now()
      if (!s || s.source !== 'web' || isPausedAt(s.events, t)) return
      const c = pos.coords
      const p: TrackPoint = {
        t,
        lat: c.latitude,
        lon: c.longitude,
        ...(Number.isFinite(c.accuracy) ? { acc: c.accuracy } : {}),
        ...(c.altitude !== null && Number.isFinite(c.altitude) ? { alt: c.altitude } : {}),
        ...(c.speed !== null && Number.isFinite(c.speed) ? { spd: c.speed } : {}),
      }
      useTracker.setState((st) => ({ points: [...st.points, p], gpsError: null }))
      void addSessionPoint(s.activityId, p).catch(() => undefined)
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) useTracker.setState({ gpsError: 'Location is blocked for this site. Allow it in the browser settings, then reload.' })
      else useTracker.setState({ gpsError: 'Waiting for GPS…' })
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  )
}

// ---- Android ----

async function nativePoints(from: number): Promise<TrackPoint[]> {
  return (await ActivityTracker.getPoints({ from })).points
}

async function askNotifications(): Promise<void> {
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') await LocalNotifications.requestPermissions()
  } catch {
    /* tracking works without the notification being visible */
  }
}

async function saveFinished(session: ActiveActivity, points: TrackPoint[], endedAt: number): Promise<string> {
  const a = buildActivity(session, points, endedAt, await currentWeightLb())
  await saveActivity(a)
  return a.id
}

let loading: Promise<void> | null = null
let polling = false

export const useTracker = create<TrackerState>((set, get) => ({
  loaded: false,
  session: null,
  points: [],
  gpsError: null,

  load() {
    loading ??= (async () => {
      try {
        if (isNative()) {
          let ns: NativeSession = await ActivityTracker.getSession()
          const action = nativeRecovery(ns)
          const header = sessionFromNative(ns)
          if (action === 'none' || !header) {
            if ((await getActiveSession())?.source === 'android') await clearActiveSession()
            set({ session: null, points: [] })
            return
          }
          const points = await nativePoints(0)
          if (action === 'save') {
            await saveFinished(header, points, ns.endedAt ?? Date.now())
            await ActivityTracker.clear()
            set({ session: null, points: [] })
            return
          }
          if (action === 'restart') ns = await ActivityTracker.ensureRunning()
          const session = sessionFromNative(ns) ?? header
          await putActiveSession(session)
          set({ session, points })
        } else {
          const row = await getActiveSession()
          if (!row || row.source !== 'web') {
            set({ session: null, points: [] })
            return
          }
          const session = recoverWebSession(row, Date.now())
          await putActiveSession(session)
          set({ session, points: await sessionPoints(session.activityId) })
          startWatch()
        }
      } catch {
        /* nothing to recover */
      } finally {
        set({ loaded: true })
      }
    })().finally(() => {
      loading = null
    })
    return loading
  },

  async start({ type, autoPause, splitCue, units }) {
    if (get().session) return
    const startedAt = Date.now()
    const base: ActiveActivity = { id: 'current', activityId: newId('act'), type, startedAt, source: isNative() ? 'android' : 'web', events: [], autoPause, splitCue, splitM: splitMeters(units) }
    if (isNative()) {
      let st = await ActivityTracker.checkLocation()
      if (st.permission !== 'granted') st = await ActivityTracker.requestLocation()
      if (st.permission === 'coarse') throw new TrackerError('precise', 'Tracking needs precise location. Turn on "Use precise location" for this app.')
      if (st.permission !== 'granted') throw new TrackerError('denied', 'Location permission is off. Allow location "While using the app" to track.')
      if (!st.gpsOn) throw new TrackerError('gps-off', 'Location is turned off on this phone. Turn it on to track.')
      await askNotifications()
      const ns = await ActivityTracker.start({ id: base.activityId, type, startedAt, autoPause, splitCue, splitM: base.splitM, unit: distUnit(units), noun: ACTIVITY[type].noun })
      const session = sessionFromNative(ns) ?? base
      await putActiveSession(session)
      set({ session, points: [], gpsError: null })
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) throw new TrackerError('unsupported', 'This browser has no GPS access.')
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' })
      if (perm?.state === 'denied') throw new TrackerError('denied', 'Location is blocked for this site. Allow it in the browser settings.')
    } catch (e) {
      if (e instanceof TrackerError) throw e
    }
    await clearActiveSession()
    await putActiveSession(base)
    set({ session: base, points: [], gpsError: null })
    startWatch()
  },

  async pause() {
    const s = get().session
    if (!s) return
    if (s.source === 'android') {
      const header = sessionFromNative(await ActivityTracker.pause())
      if (header) {
        await putActiveSession(header)
        set({ session: header })
      }
      return
    }
    const events = withEvent(s.events, 'pause', Date.now())
    set({ session: { ...s, events } })
    const last = events[events.length - 1]
    if (last && events.length > s.events.length) await addSessionEvent(last)
  },

  async resume() {
    const s = get().session
    if (!s) return
    if (s.source === 'android') {
      const header = sessionFromNative(await ActivityTracker.resume())
      if (header) {
        await putActiveSession(header)
        set({ session: header })
      }
      return
    }
    const events = withEvent(s.events, 'resume', Date.now())
    set({ session: { ...s, events } })
    const last = events[events.length - 1]
    if (last && events.length > s.events.length) await addSessionEvent(last)
    startWatch()
  },

  async finish() {
    const s = get().session
    if (!s) return null
    const endedAt = Date.now()
    let points = get().points
    if (s.source === 'android') {
      const ns = await ActivityTracker.stop()
      points = [...points, ...(await nativePoints(points.length))]
      const header = sessionFromNative(ns) ?? s
      const id = await saveFinished(header, points, ns.endedAt ?? endedAt)
      await ActivityTracker.clear()
      set({ session: null, points: [] })
      return id
    }
    stopWatch()
    // The stored fixes are the record (memory could miss one written during a reload).
    const stored = await sessionPoints(s.activityId)
    const id = await saveFinished(s, stored.length >= points.length ? stored : points, endedAt)
    set({ session: null, points: [] })
    return id
  },

  async discard() {
    const s = get().session
    if (s?.source === 'android') {
      await ActivityTracker.stop().catch(() => undefined)
      await ActivityTracker.clear().catch(() => undefined)
    }
    stopWatch()
    await clearActiveSession()
    set({ session: null, points: [], gpsError: null })
  },

  async poll() {
    const s = get().session
    if (!s || s.source !== 'android' || polling) return
    polling = true
    try {
      const ns = await ActivityTracker.getSession()
      if (!ns.active || ns.id !== s.activityId) return
      const fresh = ns.pointCount > get().points.length ? await nativePoints(get().points.length) : []
      const header = sessionFromNative(ns)
      set((st) => ({
        points: fresh.length ? [...st.points, ...fresh] : st.points,
        ...(header && header.events.length !== s.events.length ? { session: header } : {}),
      }))
      if (header && header.events.length !== s.events.length) await putActiveSession(header)
    } catch {
      /* try again next tick */
    } finally {
      polling = false
    }
  },
}))
