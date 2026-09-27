import { describe, expect, it } from 'vitest'
import type { TrackEvent } from '../../types'
import { makeTrack, M_PER_DEG_LAT, noise } from './testTrack'
import { activeMs, cleanTrack, elevationGainM, haversineM, isPausedAt, METERS_PER_MILE, segmentAt, summarize } from './track'

const T0 = 1_700_000_000_000

describe('haversine', () => {
  it('measures a degree of latitude and a known city pair', () => {
    expect(haversineM(0, 0, 1, 0)).toBeCloseTo(M_PER_DEG_LAT, 0)
    // New York (JFK) to London (LHR): about 5,540 km.
    expect(haversineM(40.6413, -73.7781, 51.47, -0.4543) / 1000).toBeCloseTo(5540, -1)
    expect(haversineM(10, 20, 10, 20)).toBe(0)
  })
})

describe('filtering', () => {
  it('drops inaccurate, out-of-order and impossible fixes', () => {
    const pts = makeTrack([{ seconds: 20, speed: 3 }])
    const bad = [
      { ...pts[5]!, t: pts[5]!.t + 100, acc: 80 }, // poor accuracy
      { ...pts[3]!, t: pts[4]!.t }, // a second fix with the same time
      { t: pts[12]!.t + 500, lat: pts[12]!.lat + 0.01, lon: pts[12]!.lon, acc: 5 }, // 1.1 km jump in half a second
    ]
    const clean = cleanTrack([...pts, ...bad], [], 'run')
    expect(clean.length).toBe(20)
    expect(clean.some((p) => Math.abs(p.lat - (pts[12]!.lat + 0.01)) < 0.001)).toBe(false)
    expect(clean.every((p, i) => i === 0 || p.t > clean[i - 1]!.t)).toBe(true)
  })

  it('accepts a real relocation after several rejected jumps instead of dropping everything', () => {
    const a = makeTrack([{ seconds: 5, speed: 2 }])
    const b = makeTrack([{ seconds: 20, speed: 2 }], T0 + 5000, 40.05) // 5.5 km away
    const clean = cleanTrack([...a, ...b], [], 'run')
    expect(clean.length).toBeGreaterThan(5 + 10)
    expect(clean.at(-1)!.lat).toBeGreaterThan(40.04)
  })

  it('smooths GPS jitter (less zig-zag distance than the raw fixes)', () => {
    const pts = makeTrack([{ seconds: 120, speed: 3, jitterM: 6 }])
    let rawD = 0
    for (let i = 1; i < pts.length; i++) rawD += haversineM(pts[i - 1]!.lat, pts[i - 1]!.lon, pts[i]!.lat, pts[i]!.lon)
    const s = summarize({ type: 'run', startedAt: T0, now: T0 + 120_000, events: [], points: pts, autoPause: false, splitM: METERS_PER_MILE })
    expect(rawD).toBeGreaterThan(400)
    expect(s.distanceM).toBeLessThan(rawD * 0.9)
    expect(s.distanceM).toBeGreaterThan(357 * 0.95) // true distance 119 s x 3 m/s
  })
})

describe('pauses and segments', () => {
  const ev: TrackEvent[] = [
    { t: T0 + 10_000, kind: 'pause' },
    { t: T0 + 40_000, kind: 'resume' },
    { t: T0 + 70_000, kind: 'gap' },
  ]
  it('knows when it is paused, the active time and the segment', () => {
    expect(isPausedAt(ev, T0 + 5_000)).toBe(false)
    expect(isPausedAt(ev, T0 + 20_000)).toBe(true)
    expect(isPausedAt(ev, T0 + 50_000)).toBe(false)
    expect(activeMs(T0, ev, T0 + 100_000)).toBe(70_000)
    expect(segmentAt(ev, T0 + 5_000)).toBe(0)
    expect(segmentAt(ev, T0 + 50_000)).toBe(1)
    expect(segmentAt(ev, T0 + 80_000)).toBe(2)
  })

  it('does not count distance or time while manually paused, even if you moved', () => {
    // 60 s at 3 m/s; paused from 20 s to 40 s while walking 60 m.
    const pts = makeTrack([{ seconds: 60, speed: 3 }])
    const events: TrackEvent[] = [
      { t: T0 + 20_000, kind: 'pause' },
      { t: T0 + 40_000, kind: 'resume' },
    ]
    const s = summarize({ type: 'run', startedAt: T0, now: T0 + 60_000, events, points: pts, autoPause: false, splitM: METERS_PER_MILE })
    expect(s.movingMs).toBe(40_000)
    // Two 20 s segments of ~19 intervals each: about 2 x 57 m, not the 177 m covered.
    expect(s.distanceM).toBeGreaterThan(100)
    expect(s.distanceM).toBeLessThan(125)
    expect(new Set(s.track.map((p) => p.seg))).toEqual(new Set([0, 1]))
    expect(summarize({ type: 'run', startedAt: T0, now: T0 + 30_000, events: events.slice(0, 1), points: pts, autoPause: false, splitM: 1000 }).state).toBe('paused')
  })
})

describe('auto-pause and moving time', () => {
  // 5 min at 3 m/s, 60 s standing at a light (GPS wobbling), 5 min at 3 m/s.
  const pts = makeTrack([
    { seconds: 300, speed: 3, jitterM: 1 },
    { seconds: 60, speed: 0, jitterM: 3 },
    { seconds: 300, speed: 3, jitterM: 1 },
  ])
  const end = T0 + 660_000

  it('takes the stop out of moving time and distance', () => {
    const s = summarize({ type: 'run', startedAt: T0, now: end, events: [], points: pts, autoPause: true, splitM: METERS_PER_MILE })
    expect(s.elapsedMs).toBe(660_000)
    expect(s.movingMs).toBeGreaterThan(590_000)
    expect(s.movingMs).toBeLessThan(612_000)
    expect(s.distanceM).toBeGreaterThan(1780 * 0.97)
    expect(s.distanceM).toBeLessThan(1800 * 1.01)
    expect(s.avgSpeedMps).toBeCloseTo(3, 0)
  })

  it('counts everything with auto-pause off', () => {
    const s = summarize({ type: 'run', startedAt: T0, now: end, events: [], points: pts, autoPause: false, splitM: METERS_PER_MILE })
    expect(s.movingMs).toBe(660_000)
  })

  it('reports auto-paused while stopped and running again after', () => {
    const stopped = pts.slice(0, 330)
    const a = summarize({ type: 'run', startedAt: T0, now: stopped.at(-1)!.t + 500, events: [], points: stopped, autoPause: true, splitM: 1000 })
    expect(a.state).toBe('autopaused')
    expect(a.currentSpeedMps).toBe(0)
    const b = summarize({ type: 'run', startedAt: T0, now: pts.at(-1)!.t + 500, events: [], points: pts, autoPause: true, splitM: 1000 })
    expect(b.state).toBe('running')
    expect(b.currentSpeedMps).toBeCloseTo(3, 0)
  })

  it('uses a lower threshold for walking than for running', () => {
    const slow = makeTrack([{ seconds: 120, speed: 0.8 }])
    const run = summarize({ type: 'run', startedAt: T0, now: T0 + 120_000, events: [], points: slow, autoPause: true, splitM: 1000 })
    const walk = summarize({ type: 'walk', startedAt: T0, now: T0 + 120_000, events: [], points: slow, autoPause: true, splitM: 1000 })
    expect(run.distanceM).toBeLessThan(5)
    expect(walk.distanceM).toBeGreaterThan(80)
  })

  it('shows no current speed once the GPS goes quiet', () => {
    const s = summarize({ type: 'run', startedAt: T0, now: pts.at(-1)!.t + 60_000, events: [], points: pts, autoPause: true, splitM: 1000 })
    expect(s.currentSpeedMps).toBeNull()
  })
})

describe('splits', () => {
  it('splits a steady 2.5-mile run into equal miles plus the part in progress', () => {
    const secs = Math.ceil((2.5 * METERS_PER_MILE) / 4) + 1
    const pts = makeTrack([{ seconds: secs, speed: 4 }])
    const s = summarize({ type: 'run', startedAt: T0, now: pts.at(-1)!.t, events: [], points: pts, autoPause: true, splitM: METERS_PER_MILE })
    expect(s.splits.map((x) => x.index)).toEqual([1, 2])
    for (const x of s.splits) {
      expect(x.distanceM).toBe(METERS_PER_MILE)
      expect(x.movingMs / 1000).toBeGreaterThan(398)
      expect(x.movingMs / 1000).toBeLessThan(410)
    }
    expect(s.currentSplit.index).toBe(3)
    expect(s.currentSplit.distanceM).toBeGreaterThan(0.45 * METERS_PER_MILE)
  })

  it('uses km splits in metric', () => {
    const pts = makeTrack([{ seconds: 700, speed: 3 }])
    const s = summarize({ type: 'run', startedAt: T0, now: pts.at(-1)!.t, events: [], points: pts, autoPause: false, splitM: 1000 })
    expect(s.splits.length).toBe(2)
  })
})

describe('elevation gain', () => {
  it('counts real climbs and ignores small wiggles (3 m hysteresis)', () => {
    const climb = Array.from({ length: 200 }, (_, i) => 100 + i * 0.1 + noise(i) * 1)
    expect(elevationGainM(climb)).toBeGreaterThan(16)
    expect(elevationGainM(climb)).toBeLessThan(24)
    const flat = Array.from({ length: 200 }, (_, i) => 100 + noise(i) * 1.5)
    expect(elevationGainM(flat)).toBe(0)
    expect(elevationGainM([100])).toBeUndefined()
  })

  it('reports the gain of a hilly track', () => {
    const pts = makeTrack([
      { seconds: 200, speed: 3, climb: 0.2 },
      { seconds: 200, speed: 3, climb: -0.2 },
    ])
    const s = summarize({ type: 'run', startedAt: T0, now: pts.at(-1)!.t, events: [], points: pts, autoPause: true, splitM: 1000 })
    expect(s.elevationGainM).toBeGreaterThan(36)
    expect(s.elevationGainM).toBeLessThan(41)
  })
})
