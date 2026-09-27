// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { ActiveActivity, Activity } from '../../types'
import { ActivitySummaryData } from '../partner/types'
import { activitySummary } from '../partner/activitySummary'
import { activityCalories, metFor } from './calories'
import { buildActivity, cardioFor } from './finish'
import { fmtDistance, fmtDuration, fmtElevation, fmtPace, fmtRate, fmtSpeed } from './format'
import { gpxFileName, toGpx } from './gpx'
import { routeBounds, simplify, toRoute } from './route'
import { nativeRecovery, recoverWebSession, sessionFromNative, withEvent } from './session'
import { makeTrack, M_PER_DEG_LAT } from './testTrack'
import { cleanTrack, haversineM, METERS_PER_MILE } from './track'

const T0 = 1_700_000_000_000

describe('calories', () => {
  it('interpolates MET by speed and clamps at the ends', () => {
    expect(metFor('run', 6 / 2.2369362920544)).toBeCloseTo(9.8, 5)
    expect(metFor('run', 6.5 / 2.2369362920544)).toBeCloseTo(10.4, 5)
    expect(metFor('run', 0.5)).toBe(6.0)
    expect(metFor('bike', 40)).toBe(15.8)
    expect(metFor('walk', 3 / 2.2369362920544)).toBeCloseTo(3.5, 5)
  })

  it('is MET x kg x hours, and absent without a weight', () => {
    // 1 h at 6 mph (MET 9.8), 70 kg -> 686 kcal
    const lb = 70 * 2.2046226218
    expect(activityCalories('run', 6 * METERS_PER_MILE, 3_600_000, lb)).toBe(686)
    expect(activityCalories('run', 1000, 600_000, undefined)).toBeUndefined()
    expect(activityCalories('run', 0, 0, 180)).toBeUndefined()
  })
})

describe('route simplification', () => {
  const line = Array.from({ length: 100 }, (_, i) => ({ lat: 40 + (i * 5) / M_PER_DEG_LAT, lon: -75 }))
  it('reduces a straight line to its ends', () => {
    expect(simplify(line, 3)).toHaveLength(2)
  })
  it('keeps corners and detail larger than the tolerance', () => {
    const corner = [...line, ...Array.from({ length: 50 }, (_, i) => ({ lat: line[99]!.lat, lon: -75 + ((i + 1) * 5) / (M_PER_DEG_LAT * Math.cos((40 * Math.PI) / 180)) }))]
    const s = simplify(corner, 3)
    expect(s).toHaveLength(3)
    expect(s[1]).toBe(line[99])
    const zig = Array.from({ length: 20 }, (_, i) => ({ lat: 40 + (i * 10) / M_PER_DEG_LAT, lon: -75 + ((i % 2) * 20) / 85_000 }))
    expect(simplify(zig, 3)).toHaveLength(20)
    expect(simplify(zig, 50)).toHaveLength(2)
  })
  it('stores a route per segment, shorter than the track but within a few meters of it', () => {
    const pts = makeTrack([{ seconds: 600, speed: 3, jitterM: 2 }])
    const events = [
      { t: T0 + 300_000, kind: 'pause' as const },
      { t: T0 + 310_000, kind: 'resume' as const },
    ]
    const track = cleanTrack(pts, events, 'run')
    const route = toRoute(track, T0)
    expect(route).toHaveLength(2)
    const kept = route.flat().length
    expect(kept).toBeLessThan(track.length / 5)
    expect(route[0]![0]![0]).toBe(0)
    // Every smoothed fix lies within the 3 m tolerance of the stored line (plus rounding).
    const cos = Math.cos((40 * Math.PI) / 180)
    const xy = (lat: number, lon: number) => [(lon + 75) * M_PER_DEG_LAT * cos, (lat - 40) * M_PER_DEG_LAT] as const
    for (const p of track) {
      const seg = route[p.seg]!
      let best = Infinity
      for (let i = 1; i < seg.length; i++) {
        const [ax, ay] = xy(seg[i - 1]![1], seg[i - 1]![2])
        const [bx, by] = xy(seg[i]![1], seg[i]![2])
        const [px, py] = xy(p.lat, p.lon)
        const L2 = (bx - ax) ** 2 + (by - ay) ** 2
        const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2)) : 0
        best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))))
      }
      expect(best).toBeLessThan(3.2)
    }
    expect(haversineM(route[0]![0]![1], route[0]![0]![2], track[0]!.lat, track[0]!.lon)).toBeLessThan(0.2)
    expect(routeBounds(route)!.maxLat).toBeGreaterThan(routeBounds(route)!.minLat)
    expect(routeBounds([])).toBeNull()
  })
})

function session(over: Partial<ActiveActivity> = {}): ActiveActivity {
  return { id: 'current', activityId: 'act-1', type: 'run', startedAt: T0, source: 'web', events: [], autoPause: true, splitCue: false, splitM: METERS_PER_MILE, ...over }
}

describe('finished activity', () => {
  const pts = makeTrack([{ seconds: 900, speed: 3.2, climb: 0.02 }])
  const a = buildActivity(session(), pts, T0 + 900_000, 180)

  it('holds the stats, splits (with the last partial one), calories and a simplified route', () => {
    expect(a.distanceM / METERS_PER_MILE).toBeCloseTo(1.79, 1)
    expect(a.movingMs).toBe(900_000)
    expect(a.splits).toHaveLength(2)
    expect(a.splits[1]!.distanceM).toBeLessThan(METERS_PER_MILE)
    expect(a.calories).toBeGreaterThan(150)
    expect(a.elevationGainM).toBeGreaterThan(10)
    expect(a.route.flat().length).toBeLessThan(50)
    expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('becomes a cardio entry with the same id', () => {
    expect(cardioFor(a)).toEqual({ id: 'act-1', date: a.date, kind: 'run', minutes: 15, activityId: 'act-1', distanceM: a.distanceM })
    expect(cardioFor({ ...a, type: 'bike' }).kind).toBe('bike')
  })

  it('exports well-formed GPX 1.1 with points in time order', () => {
    const withGap: Activity = { ...a, route: [a.route[0]!.slice(0, 5), [[800, 40.1, -75, null], [700, 40.09, -75, 101]]] }
    const xml = toGpx({ ...withGap, notes: '<b> & "x"' }, 'Right<Pace>')
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    const gpx = doc.documentElement
    expect(gpx.getAttribute('version')).toBe('1.1')
    expect(gpx.namespaceURI).toBe('http://www.topografix.com/GPX/1/1')
    expect(gpx.getAttribute('creator')).toBe('Right<Pace>')
    expect(doc.getElementsByTagName('trkseg')).toHaveLength(2)
    const times = [...doc.getElementsByTagName('trkpt')].map((p) => Date.parse(p.getElementsByTagName('time')[0]!.textContent ?? ''))
    const first = withGap.route[0]!.length
    expect(times).toHaveLength(first + 2)
    for (let i = 1; i < first; i++) expect(times[i]!).toBeGreaterThan(times[i - 1]!)
    expect(times[first]!).toBeLessThan(times[first + 1]!) // second segment written in time order
    expect(doc.getElementsByTagName('type')[0]!.textContent).toBe('running')
    const pt = doc.getElementsByTagName('trkpt')[0]!
    expect(Number(pt.getAttribute('lat'))).toBeCloseTo(40, 3)
    expect(gpxFileName(a)).toBe(`rightpace-run-${a.date}.gpx`)
  })

  it('shares only type, date, distance, time and pace with the partner', () => {
    const s = activitySummary(a)
    expect(Object.keys(s).sort()).toEqual(['avgSpeedMps', 'date', 'distanceM', 'finishedAt', 'movingMs', 'type'])
    const json = JSON.stringify(s)
    expect(json).not.toMatch(/lat|lon|route|40\.0|-75/)
    expect(ActivitySummaryData.parse(s)).toEqual(s)
    // A summary carrying anything else (a route, a start point) is rejected on the way in.
    expect(ActivitySummaryData.safeParse({ ...s, route: a.route }).success).toBe(false)
    expect(ActivitySummaryData.safeParse({ ...s, start: [40, -75] }).success).toBe(false)
  })
})

describe('session rules and recovery', () => {
  it('ignores a double pause or resume', () => {
    const e1 = withEvent([], 'pause', T0 + 1000)
    expect(e1).toEqual([{ t: T0 + 1000, kind: 'pause' }])
    expect(withEvent(e1, 'pause', T0 + 2000)).toEqual(e1)
    expect(withEvent(e1, 'resume', T0 + 3000)).toHaveLength(2)
    expect(withEvent([], 'resume', T0)).toEqual([])
  })

  it('adds a gap after a reload unless paused', () => {
    expect(recoverWebSession(session(), T0 + 5000).events).toEqual([{ t: T0 + 5000, kind: 'gap' }])
    const paused = session({ events: [{ t: T0 + 100, kind: 'pause' }] })
    expect(recoverWebSession(paused, T0 + 5000)).toBe(paused)
  })

  it('decides what to do with an Android session on opening', () => {
    expect(nativeRecovery({ active: false, running: false })).toBe('none')
    expect(nativeRecovery({ active: true, running: true })).toBe('continue')
    expect(nativeRecovery({ active: true, running: false })).toBe('restart')
    expect(nativeRecovery({ active: true, running: false, endedAt: T0 })).toBe('save')
    expect(sessionFromNative({ id: 'a', type: 'bike', startedAt: T0, events: [{ t: T0 + 1, kind: 'gap' }] })).toMatchObject({ activityId: 'a', type: 'bike', source: 'android', autoPause: true, splitM: 1609.344 })
    expect(sessionFromNative({ id: 'a', type: 'swim', startedAt: T0, events: [] })).toBeNull()
    expect(sessionFromNative({ events: [] })).toBeNull()
  })

  it('a session recovered from stored fixes after a reload gives the same activity minus the gap', () => {
    const pts = makeTrack([{ seconds: 600, speed: 3 }])
    const before = pts.filter((p) => p.t < T0 + 300_000)
    const after = pts.filter((p) => p.t >= T0 + 320_000)
    const recovered = recoverWebSession(session(), T0 + 319_000)
    const a = buildActivity(recovered, [...before, ...after], T0 + 600_000, undefined)
    expect(a.route).toHaveLength(2)
    // The 20 s without fixes adds no straight-line distance; everything else counts.
    expect(a.distanceM).toBeGreaterThan(1720)
    expect(a.distanceM).toBeLessThan(1745)
  })
})

describe('formatting', () => {
  it('formats distance, time, pace, speed and elevation', () => {
    expect(fmtDistance(METERS_PER_MILE * 1.249, 'imperial')).toBe('1.24')
    expect(fmtDistance(2500, 'metric')).toBe('2.50')
    expect(fmtDuration(723_000)).toBe('12:03')
    expect(fmtDuration(3_723_000)).toBe('1:02:03')
    expect(fmtPace(METERS_PER_MILE / 485, 'imperial')).toBe('8:05')
    expect(fmtPace(0, 'imperial')).toBe('--:--')
    expect(fmtPace(null, 'metric')).toBe('--:--')
    expect(fmtSpeed(METERS_PER_MILE / 240, 'imperial')).toBe('15.0')
    expect(fmtRate('bike', 10, 'metric')).toEqual({ value: '36.0', unit: 'km/h' })
    expect(fmtRate('run', 1000 / 300, 'metric')).toEqual({ value: '5:00', unit: '/km' })
    expect(fmtElevation(30.48, 'imperial')).toBe('100 ft')
  })
})
