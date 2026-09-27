import { describe, expect, it } from 'vitest'
import type { Activity, RoutePoint } from '../../types'
import { activityRoute, fitRoute, routeForMap, routeShareable, ROUTE_SHARE_DAYS } from './activityRoute'
import { ActivityRouteData, MAX_SHARED_ROUTE_POINTS } from './types'

// A wiggly route (a long run) in one segment, or one of many segments.
const wiggle = (n: number, seg = 0): RoutePoint[] =>
  Array.from({ length: n }, (_, i): RoutePoint => [i, 40 + seg * 0.01 + i * 0.00003, -75 + Math.sin(i / 7) * 0.0004, 100])

const activity = (route: RoutePoint[][], startedAt = Date.now()): Activity => ({
  id: 'a1',
  type: 'run',
  date: '2026-09-27',
  startedAt,
  endedAt: startedAt + 3_600_000,
  movingMs: 3_500_000,
  elapsedMs: 3_600_000,
  distanceM: 16_000,
  avgSpeedMps: 4.5,
  splitM: 1609.344,
  splits: [{ index: 1, distanceM: 1609.344, movingMs: 400_000 }],
  route,
  source: 'android',
  autoPause: true,
})

const points = (segs: readonly (readonly unknown[])[]) => segs.reduce((n, s) => n + s.length, 0)

describe('shared route', () => {
  it('fits a long route in 400 points, rounded to 5 decimals', () => {
    const segs = fitRoute([wiggle(5000)])
    expect(points(segs)).toBeLessThanOrEqual(MAX_SHARED_ROUTE_POINTS)
    expect(points(segs)).toBeGreaterThan(20)
    for (const [lat, lon] of segs.flat()) {
      expect(Math.round(lat * 1e5) / 1e5).toBe(lat)
      expect(Math.round(lon * 1e5) / 1e5).toBe(lon)
    }
  })

  it('stays within 400 points even with many segments', () => {
    const many = Array.from({ length: 300 }, (_, s) => wiggle(40, s))
    expect(points(fitRoute(many))).toBeLessThanOrEqual(MAX_SHARED_ROUTE_POINTS)
  })

  it('keeps a short route (apart from rounding)', () => {
    const segs = fitRoute([wiggle(10)])
    expect(points(segs)).toBeLessThanOrEqual(10)
    expect(segs[0]?.[0]).toEqual([40, -75])
  })

  it('builds a strict payload far under the 64 KiB record cap, with only route, start and splits', () => {
    const data = activityRoute(activity([wiggle(5000), wiggle(3000, 1)]))
    expect(ActivityRouteData.parse(data)).toEqual(data)
    expect(Object.keys(data).sort()).toEqual(['segments', 'splitM', 'splits', 'startedAt'])
    // Sealed size is about the JSON * 4/3 (base64) plus a small overhead.
    expect(JSON.stringify(data).length).toBeLessThan(16 * 1024)
    expect(() => ActivityRouteData.parse({ ...data, extra: 1 })).toThrow()
  })

  it('rejects a payload with more than 400 points', () => {
    const data = activityRoute(activity([wiggle(50)]))
    expect(() => ActivityRouteData.parse({ ...data, segments: [Array.from({ length: 401 }, () => [40, -75])] })).toThrow()
    expect(() => ActivityRouteData.parse({ ...data, segments: [Array.from({ length: 300 }, () => [40, -75]), Array.from({ length: 101 }, () => [40, -75])] })).toThrow()
  })

  it('is shareable for 30 days after the activity, then not', () => {
    const now = Date.now()
    expect(routeShareable({ startedAt: now - (ROUTE_SHARE_DAYS - 1) * 86_400_000 }, now)).toBe(true)
    expect(routeShareable({ startedAt: now - ROUTE_SHARE_DAYS * 86_400_000 }, now)).toBe(false)
  })

  it('turns shared segments back into drawable routes', () => {
    expect(
      routeForMap([
        [
          [40, -75],
          [40.001, -75],
        ],
      ]),
    ).toEqual([
      [
        [0, 40, -75, null],
        [0, 40.001, -75, null],
      ],
    ])
  })
})
