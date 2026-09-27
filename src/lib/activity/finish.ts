import type { ActiveActivity, Activity, CardioKind, CardioLog, TrackPoint } from '../../types'
import { todayIso } from '../dates'
import { activityCalories } from './calories'
import { toRoute } from './route'
import { summarize } from './track'

/** The saved activity, computed from every raw fix of the session. */
export function buildActivity(session: Omit<ActiveActivity, 'id'>, points: readonly TrackPoint[], endedAt: number, weightLb: number | undefined): Activity {
  const s = summarize({ type: session.type, startedAt: session.startedAt, now: endedAt, events: session.events, points, autoPause: session.autoPause, splitM: session.splitM })
  // The last, partial split is kept when it is at least 10% of a split.
  const splits = [...s.splits]
  if (s.currentSplit.distanceM >= session.splitM * 0.1) splits.push({ index: s.currentSplit.index, distanceM: Math.round(s.currentSplit.distanceM), movingMs: s.currentSplit.movingMs })
  const calories = activityCalories(session.type, s.distanceM, s.movingMs, weightLb)
  return {
    id: session.activityId,
    type: session.type,
    date: todayIso(new Date(session.startedAt)),
    startedAt: session.startedAt,
    endedAt,
    movingMs: Math.round(s.movingMs),
    elapsedMs: Math.round(s.elapsedMs),
    distanceM: Math.round(s.distanceM * 10) / 10,
    ...(s.elevationGainM !== undefined ? { elevationGainM: Math.round(s.elevationGainM) } : {}),
    avgSpeedMps: Math.round(s.avgSpeedMps * 1000) / 1000,
    splitM: session.splitM,
    splits,
    ...(calories !== undefined ? { calories } : {}),
    route: toRoute(s.track, session.startedAt),
    source: session.source,
    autoPause: session.autoPause,
  }
}

const CARDIO_KIND: Record<Activity['type'], CardioKind> = { run: 'run', walk: 'walk', bike: 'bike', hike: 'hike' }

/** The cardio entry an activity counts as (same id), so the cardio log, weekly minutes and Today count it. */
export function cardioFor(a: Activity): CardioLog {
  return { id: a.id, date: a.date, kind: CARDIO_KIND[a.type], minutes: Math.max(1, Math.round(a.movingMs / 60_000)), activityId: a.id, distanceM: a.distanceM }
}
