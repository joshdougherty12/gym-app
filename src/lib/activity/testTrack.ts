import type { TrackPoint } from '../../types'

// Synthetic GPS tracks for tests (not shipped: only test files import it).

export const M_PER_DEG_LAT = 111_195.08 // for the mean Earth radius used by haversineM

/** Deterministic pseudo-random in [-1, 1]. */
export function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

export interface Leg {
  seconds: number
  /** m/s northward (0 = standing still). */
  speed: number
  /** Position noise amplitude, m. */
  jitterM?: number
  /** Climb rate, m/s. */
  climb?: number
}

/** 1 Hz fixes starting at t0 from (lat0, lon0), heading north, leg after leg. */
export function makeTrack(legs: readonly Leg[], t0 = 1_700_000_000_000, lat0 = 40, lon0 = -75, acc = 5): TrackPoint[] {
  const out: TrackPoint[] = []
  let north = 0
  let alt = 100
  let i = 0
  for (const leg of legs) {
    for (let s = 0; s < leg.seconds; s++) {
      const j = leg.jitterM ?? 0
      out.push({
        t: t0 + i * 1000,
        lat: lat0 + (north + j * noise(i + 1)) / M_PER_DEG_LAT,
        lon: lon0 + (j * noise(i + 1000)) / (M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180)),
        acc,
        alt,
      })
      north += leg.speed
      alt += leg.climb ?? 0
      i++
    }
  }
  return out
}
