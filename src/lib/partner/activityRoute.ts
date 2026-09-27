import type { Activity, RoutePoint } from '../../types'
import { simplify } from '../activity/route'
import { MAX_SHARED_ROUTE_POINTS, type ActivityRouteData } from './types'

/** Routes are shared for this long after an activity, then only the summary stays. */
export const ROUTE_SHARE_DAYS = 30
const ROUTE_SHARE_MS = ROUTE_SHARE_DAYS * 24 * 3600 * 1000

/** Whether an activity is recent enough for its route to be shared. */
export function routeShareable(a: Pick<Activity, 'startedAt'>, now = Date.now()): boolean {
  return now - a.startedAt < ROUTE_SHARE_MS
}

const r5 = (x: number) => Math.round(x * 1e5) / 1e5

interface LatLon {
  lat: number
  lon: number
}

const count = (segs: readonly (readonly unknown[])[]) => segs.reduce((n, s) => n + s.length, 0)

/**
 * Simplify every segment with one shared tolerance, doubling it until the
 * whole route fits in `max` points. Keeps each segment's ends. As a last
 * resort (hundreds of tiny segments) keeps every nth point.
 */
export function fitRoute(route: readonly RoutePoint[][], max = MAX_SHARED_ROUTE_POINTS): [number, number][][] {
  const segs: LatLon[][] = route.filter((s) => s.length > 0).map((s) => s.map((p) => ({ lat: p[1], lon: p[2] })))
  let out = segs
  for (let tol = 5; count(out) > max && tol <= 5000; tol *= 2) out = segs.map((s) => simplify(s, tol))
  if (count(out) > max) {
    // Too many segments for simplification alone: drop points evenly, keeping at least the ends of the first segments.
    const flat = out.flatMap((s, i) => s.map((p) => ({ p, i })))
    const step = flat.length / max
    const kept = Array.from({ length: max }, (_, k) => flat[Math.floor(k * step)]).filter((x) => x !== undefined)
    const bySeg = new Map<number, LatLon[]>()
    for (const { p, i } of kept) bySeg.set(i, [...(bySeg.get(i) ?? []), p])
    out = [...bySeg.values()]
  }
  return out.map((s) => s.map((p): [number, number] => [r5(p.lat), r5(p.lon)])).filter((s) => s.length > 0)
}

/**
 * What the partner receives for one activity's map: the route (at most 400
 * points, about 1 m precision), its start time and the splits. Built field by
 * field so nothing else on the activity travels.
 */
export function activityRoute(a: Activity): ActivityRouteData {
  return {
    startedAt: a.startedAt,
    segments: fitRoute(a.route),
    splitM: a.splitM,
    splits: a.splits.slice(0, 200).map((s) => ({ index: s.index, distanceM: Math.round(s.distanceM), movingMs: Math.round(s.movingMs) })),
  }
}

/** Shared segments back into the stored route shape the map components draw (no times or elevation). */
export function routeForMap(segments: ActivityRouteData['segments']): RoutePoint[][] {
  return segments.map((s) => s.map(([lat, lon]): RoutePoint => [0, lat, lon, null]))
}
