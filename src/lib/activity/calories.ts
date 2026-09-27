import type { ActivityType } from '../../types'
import { LB_PER_KG } from '../units'

// MET values by speed, from the Compendium of Physical Activities (2011/2024),
// interpolated between rows and held flat past the ends.
// Calories = MET x body mass (kg) x moving hours. An estimate, labelled as one.
const MPH = 2.2369362920544 // m/s -> mph

const TABLE: Record<ActivityType, readonly (readonly [number, number])[]> = {
  // [mph, MET]
  run: [
    [4, 6.0],
    [5, 8.3],
    [6, 9.8],
    [7, 11.0],
    [8, 11.8],
    [9, 12.8],
    [10, 14.5],
    [11, 16.0],
    [12, 19.0],
  ],
  walk: [
    [1.5, 2.3],
    [2.0, 2.8],
    [2.5, 3.0],
    [3.0, 3.5],
    [3.5, 4.3],
    [4.0, 5.0],
    [4.5, 7.0],
    [5.0, 8.3],
  ],
  // Hiking over mixed terrain is harder than a flat walk at the same speed.
  hike: [
    [1.5, 5.3],
    [2.5, 6.0],
    [3.5, 7.0],
  ],
  bike: [
    [5.5, 3.5],
    [9.4, 5.8],
    [11, 6.8],
    [13, 8.0],
    [15, 10.0],
    [18, 12.0],
    [21, 15.8],
  ],
}

/** MET for an activity at an average speed (m/s). */
export function metFor(type: ActivityType, speedMps: number): number {
  const rows = TABLE[type]
  const mph = speedMps * MPH
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (!first || !last) return 0
  if (mph <= first[0]) return first[1]
  if (mph >= last[0]) return last[1]
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    if (a && b && mph <= b[0]) return a[1] + ((mph - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
  }
  return last[1]
}

/** Estimated kcal, rounded; undefined without a body weight or with no moving time. */
export function activityCalories(type: ActivityType, distanceM: number, movingMs: number, weightLb: number | undefined): number | undefined {
  if (!weightLb || weightLb <= 0 || movingMs <= 0) return undefined
  const speed = distanceM / (movingMs / 1000)
  return Math.round(metFor(type, speed) * (weightLb / LB_PER_KG) * (movingMs / 3_600_000))
}
