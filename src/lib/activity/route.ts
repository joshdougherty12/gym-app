import type { RoutePoint } from '../../types'
import type { CleanPoint } from './track'

/**
 * Stored route: the smoothed track, simplified with Douglas-Peucker at 3 m.
 *
 * Choice: the full 1-per-second track is not kept after an activity is saved.
 * The smoothed track is already only as good as the GPS (a few meters), so a
 * 3 m tolerance changes the drawn route and the GPX by less than the GPS error
 * while cutting the points 5-10x (an hour's run: about 3,600 fixes -> a few
 * hundred, tens of KB). Distance, splits and elevation are computed from the
 * full track before simplifying, so they are not affected. The GPX export
 * uses this stored route, with each kept point's own time and elevation.
 */
export const ROUTE_TOLERANCE_M = 3

interface LatLon {
  lat: number
  lon: number
}

/** Douglas-Peucker simplification (iterative), tolerance in meters. Keeps the first and last point. */
export function simplify<T extends LatLon>(pts: readonly T[], tolM: number): T[] {
  if (pts.length <= 2) return [...pts]
  const first = pts[0]
  if (!first) return []
  // Local flat projection (meters): fine at the scale of one activity.
  const k = 111_320
  const cos = Math.cos((first.lat * Math.PI) / 180)
  const xy = pts.map((p) => [(p.lon - first.lon) * k * cos, (p.lat - first.lat) * k] as const)
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop() ?? [0, 0]
    const pa = xy[a]
    const pb = xy[b]
    if (!pa || !pb) continue
    const dx = pb[0] - pa[0]
    const dy = pb[1] - pa[1]
    const len2 = dx * dx + dy * dy
    let maxD = -1
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const p = xy[i]
      if (!p) continue
      let d: number
      if (len2 === 0) d = Math.hypot(p[0] - pa[0], p[1] - pa[1])
      else {
        const t = Math.max(0, Math.min(1, ((p[0] - pa[0]) * dx + (p[1] - pa[1]) * dy) / len2))
        d = Math.hypot(p[0] - (pa[0] + t * dx), p[1] - (pa[1] + t * dy))
      }
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (idx > 0 && maxD > tolM) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i] === 1)
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6

/** Smoothed track -> stored route, one simplified array per segment. */
export function toRoute(track: readonly CleanPoint[], startedAt: number, tolM = ROUTE_TOLERANCE_M): RoutePoint[][] {
  const segs = new Map<number, CleanPoint[]>()
  for (const p of track) {
    const s = segs.get(p.seg)
    if (s) s.push(p)
    else segs.set(p.seg, [p])
  }
  return [...segs.values()].map((s) =>
    simplify(s, tolM).map((p): RoutePoint => [Math.round((p.t - startedAt) / 100) / 10, r6(p.lat), r6(p.lon), p.alt !== undefined ? Math.round(p.alt * 10) / 10 : null]),
  )
}

/** Bounding box of a route, or null when empty. */
export function routeBounds(route: readonly RoutePoint[][]): { minLat: number; maxLat: number; minLon: number; maxLon: number } | null {
  let b: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null = null
  for (const seg of route)
    for (const [, lat, lon] of seg) {
      if (!b) b = { minLat: lat, maxLat: lat, minLon: lon, maxLon: lon }
      else {
        b.minLat = Math.min(b.minLat, lat)
        b.maxLat = Math.max(b.maxLat, lat)
        b.minLon = Math.min(b.minLon, lon)
        b.maxLon = Math.max(b.maxLon, lon)
      }
    }
  return b
}
