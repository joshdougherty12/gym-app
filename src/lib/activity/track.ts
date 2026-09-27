import type { ActivitySplit, ActivityType, TrackEvent, TrackPoint } from '../../types'

// GPS track processing: pure functions, recomputed from the raw fixes each
// second while tracking and once more when the activity is saved.
//
// Pipeline: drop paused / inaccurate / impossible fixes -> Kalman smoothing
// (per segment) -> distance by haversine -> auto-pause (trailing-window speed
// under a threshold) -> moving time, splits, elevation gain.

export const METERS_PER_MILE = 1609.344
/** Fixes reported worse than this (horizontal accuracy, m) are dropped. */
export const MAX_ACCURACY_M = 30
/** Speed over this trailing window decides auto-pause ("stays under the threshold for a few seconds"). */
export const AUTO_PAUSE_WINDOW_MS = 6_000
/** Current speed and pace are averaged over this trailing window. */
export const CURRENT_WINDOW_MS = 12_000
/** After this many consecutive rejected jumps the new position is accepted (the old one was the bad one). */
const MAX_REJECTED_JUMPS = 5
/** No fix for this long: current speed is unknown ("waiting for GPS"). */
export const STALE_FIX_MS = 12_000

export interface ActivityProfile {
  label: string
  /** "Tracking run" in the Android notification. */
  noun: string
  /** Faster than this between two fixes is a GPS jump, not movement (m/s). */
  maxSpeedMps: number
  /** Trailing-window speed under this counts as stopped (auto-pause, m/s). */
  autoPauseMps: number
  /** Kalman process noise: how fast position can plausibly change (m/s). */
  kalmanQ: number
  /** Bike shows speed (mph, km/h); the others show pace (min/mi, min/km). */
  showSpeed: boolean
}

export const ACTIVITY: Record<ActivityType, ActivityProfile> = {
  run: { label: 'Run', noun: 'run', maxSpeedMps: 10, autoPauseMps: 1.0, kalmanQ: 3, showSpeed: false },
  walk: { label: 'Walk', noun: 'walk', maxSpeedMps: 5, autoPauseMps: 0.45, kalmanQ: 1.5, showSpeed: false },
  hike: { label: 'Hike', noun: 'hike', maxSpeedMps: 5, autoPauseMps: 0.35, kalmanQ: 1.5, showSpeed: false },
  bike: { label: 'Ride', noun: 'ride', maxSpeedMps: 25, autoPauseMps: 1.5, kalmanQ: 6, showSpeed: true },
}

export const ACTIVITY_TYPES: readonly ActivityType[] = ['run', 'walk', 'bike', 'hike']

const R = 6_371_008.8 // mean Earth radius, m
const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in meters. */
export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ---- Manual pauses and segments ----

const byTime = (events: readonly TrackEvent[]) => [...events].sort((a, b) => a.t - b.t)

/** Manually paused at time t (the last pause/resume at or before t was a pause). */
export function isPausedAt(events: readonly TrackEvent[], t: number): boolean {
  let paused = false
  for (const e of byTime(events)) {
    if (e.t > t) break
    if (e.kind === 'pause') paused = true
    else if (e.kind === 'resume') paused = false
  }
  return paused
}

/** Wall-clock time from start to `end` minus manual pauses. */
export function activeMs(startedAt: number, events: readonly TrackEvent[], end: number): number {
  let total = 0
  let runFrom: number | null = startedAt
  for (const e of byTime(events)) {
    if (e.t > end) break
    if (e.kind === 'pause' && runFrom !== null) {
      total += Math.max(0, e.t - runFrom)
      runFrom = null
    } else if (e.kind === 'resume' && runFrom === null) runFrom = e.t
  }
  if (runFrom !== null) total += Math.max(0, end - runFrom)
  return total
}

/** Segment number at time t: each resume or gap starts a new one; distance never joins two segments. */
export function segmentAt(events: readonly TrackEvent[], t: number): number {
  let seg = 0
  for (const e of events) if (e.t <= t && (e.kind === 'resume' || e.kind === 'gap')) seg++
  return seg
}

// ---- Cleaning and smoothing ----

export interface CleanPoint {
  t: number
  lat: number
  lon: number
  alt?: number
  seg: number
}

/**
 * Drop fixes taken while paused, fixes worse than MAX_ACCURACY_M, out-of-order
 * fixes and impossible jumps (faster than the activity's max speed from the
 * last good fix), then smooth each segment with a simple Kalman filter whose
 * measurement noise is the reported accuracy.
 */
export function cleanTrack(points: readonly TrackPoint[], events: readonly TrackEvent[], type: ActivityType): CleanPoint[] {
  const prof = ACTIVITY[type]
  const out: CleanPoint[] = []
  let lastRaw: { t: number; lat: number; lon: number; seg: number } | null = null
  let rejected = 0
  let k: { lat: number; lon: number; varM2: number; t: number; seg: number } | null = null
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) continue
    if (isPausedAt(events, p.t)) continue
    if (p.acc !== undefined && p.acc > MAX_ACCURACY_M) continue
    const seg = segmentAt(events, p.t)
    if (lastRaw && lastRaw.seg === seg) {
      if (p.t <= lastRaw.t) continue
      const v = haversineM(lastRaw.lat, lastRaw.lon, p.lat, p.lon) / ((p.t - lastRaw.t) / 1000)
      if (v > prof.maxSpeedMps && rejected < MAX_REJECTED_JUMPS) {
        rejected++
        continue
      }
    }
    rejected = 0
    lastRaw = { t: p.t, lat: p.lat, lon: p.lon, seg }
    const acc = Math.max(3, p.acc ?? 10)
    if (!k || k.seg !== seg) k = { lat: p.lat, lon: p.lon, varM2: acc * acc, t: p.t, seg }
    else {
      k.varM2 += ((p.t - k.t) / 1000) * prof.kalmanQ * prof.kalmanQ
      const gain = k.varM2 / (k.varM2 + acc * acc)
      k.lat += gain * (p.lat - k.lat)
      k.lon += gain * (p.lon - k.lon)
      k.varM2 *= 1 - gain
      k.t = p.t
    }
    out.push({ t: p.t, lat: k.lat, lon: k.lon, seg, ...(p.alt !== undefined && Number.isFinite(p.alt) ? { alt: p.alt } : {}) })
  }
  return out
}

// ---- Elevation ----

/** Elevation gain climbs of at least `hysteresisM` count; smaller wiggles are GPS noise. Altitudes are first averaged over 5 fixes. */
export function elevationGainM(alts: readonly number[], hysteresisM = 3): number | undefined {
  if (alts.length < 2) return undefined
  const smooth = alts.map((_, i) => {
    const w = alts.slice(Math.max(0, i - 2), i + 3)
    return w.reduce((s, a) => s + a, 0) / w.length
  })
  let ref = smooth[0] ?? 0
  let gain = 0
  for (const a of smooth) {
    if (a >= ref + hysteresisM) {
      gain += a - ref
      ref = a
    } else if (a <= ref - hysteresisM) ref = a
  }
  return gain
}

// ---- Summary ----

export interface TrackInput {
  type: ActivityType
  startedAt: number
  /** Now while tracking; the end time when finished. */
  now: number
  events: readonly TrackEvent[]
  points: readonly TrackPoint[]
  autoPause: boolean
  /** 1609.344 for miles, 1000 for km. */
  splitM: number
}

export type TrackState = 'running' | 'paused' | 'autopaused'

export interface TrackStats {
  elapsedMs: number
  movingMs: number
  distanceM: number
  /** Distance / moving time; 0 before any distance. */
  avgSpeedMps: number
  /** Over the last few seconds; 0 when stopped, null with no recent fix. */
  currentSpeedMps: number | null
  splits: ActivitySplit[]
  /** The split in progress. */
  currentSplit: { index: number; distanceM: number; movingMs: number }
  elevationGainM?: number
  state: TrackState
  lastFixAt?: number
  track: CleanPoint[]
}

/** Everything the live screen and the saved activity show, from the raw fixes. */
export function summarize(input: TrackInput): TrackStats {
  const { type, startedAt, now, events, autoPause, splitM } = input
  const prof = ACTIVITY[type]
  const track = cleanTrack(input.points, events, type)
  const n = track.length
  // cum[i]: counted distance up to point i (stopped intervals excluded).
  const cum = new Array<number>(n).fill(0)
  const stoppedCum = new Array<number>(n).fill(0)
  const stopped = new Array<boolean>(n).fill(false)
  for (let i = 1; i < n; i++) {
    const a = track[i - 1]
    const b = track[i]
    if (!a || !b) continue
    const same = a.seg === b.seg
    const d = same ? haversineM(a.lat, a.lon, b.lat, b.lon) : 0
    let isStopped = false
    if (same && autoPause) {
      let j = i - 1
      while (j > 0 && track[j - 1]?.seg === b.seg && b.t - (track[j - 1]?.t ?? 0) <= AUTO_PAUSE_WINDOW_MS) j--
      // Straight-line displacement over the window, not path length: GPS wobble
      // while standing still adds path but goes nowhere.
      const pj = track[j]
      const dt = (b.t - (pj?.t ?? b.t)) / 1000
      const v = dt > 0 && pj ? haversineM(pj.lat, pj.lon, b.lat, b.lon) / dt : 0
      isStopped = v < prof.autoPauseMps
    }
    stopped[i] = isStopped
    cum[i] = (cum[i - 1] ?? 0) + (isStopped ? 0 : d)
    stoppedCum[i] = (stoppedCum[i - 1] ?? 0) + (isStopped ? b.t - a.t : 0)
  }
  const distanceM = n ? (cum[n - 1] ?? 0) : 0
  const movingAt = (i: number) => Math.max(0, activeMs(startedAt, events, track[i]?.t ?? startedAt) - (stoppedCum[i] ?? 0))
  const movingMs = Math.max(0, activeMs(startedAt, events, now) - (n ? (stoppedCum[n - 1] ?? 0) : 0))

  // Splits: interpolate the moving time where the counted distance crosses each boundary.
  const splits: ActivitySplit[] = []
  let next = splitM
  let lastSplitMoving = 0
  for (let i = 1; i < n; i++) {
    const c0 = cum[i - 1] ?? 0
    const c1 = cum[i] ?? 0
    if (c1 <= c0) continue
    const m0 = movingAt(i - 1)
    const m1 = movingAt(i)
    while (c1 >= next) {
      const at = m0 + ((next - c0) / (c1 - c0)) * (m1 - m0)
      splits.push({ index: splits.length + 1, distanceM: splitM, movingMs: Math.max(0, Math.round(at - lastSplitMoving)) })
      lastSplitMoving = at
      next += splitM
    }
  }

  const last = track[n - 1]
  let currentSpeedMps: number | null = null
  if (last && now - last.t <= STALE_FIX_MS) {
    if (stopped[n - 1]) currentSpeedMps = 0
    else {
      let j = n - 1
      while (j > 0 && track[j - 1]?.seg === last.seg && last.t - (track[j - 1]?.t ?? 0) <= CURRENT_WINDOW_MS) j--
      const dt = (last.t - (track[j]?.t ?? last.t)) / 1000
      currentSpeedMps = dt >= 2 ? ((cum[n - 1] ?? 0) - (cum[j] ?? 0)) / dt : null
    }
  }

  const alts = track.flatMap((p) => (p.alt !== undefined ? [p.alt] : []))
  const gain = elevationGainM(alts)
  const paused = isPausedAt(events, now)
  const state: TrackState = paused ? 'paused' : autoPause && last && stopped[n - 1] && now - last.t <= STALE_FIX_MS ? 'autopaused' : 'running'
  return {
    elapsedMs: Math.max(0, now - startedAt),
    movingMs,
    distanceM,
    avgSpeedMps: movingMs > 0 ? distanceM / (movingMs / 1000) : 0,
    currentSpeedMps,
    splits,
    currentSplit: { index: splits.length + 1, distanceM: Math.max(0, distanceM - splits.length * splitM), movingMs: Math.max(0, movingMs - lastSplitMoving) },
    ...(gain !== undefined ? { elevationGainM: gain } : {}),
    state,
    ...(last ? { lastFixAt: last.t } : {}),
    track,
  }
}
