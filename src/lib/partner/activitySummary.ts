import type { Activity } from '../../types'
import type { ActivitySummaryData } from './types'

/**
 * A finished activity as the partner sees it: type, date, distance, moving
 * time and average pace/speed. Built field by field (never by spreading the
 * activity) so the route, coordinates and start location can never leak.
 */
export function activitySummary(a: Activity): ActivitySummaryData {
  return {
    date: a.date,
    type: a.type,
    distanceM: Math.round(a.distanceM),
    movingMs: Math.round(a.movingMs),
    avgSpeedMps: Math.round(a.avgSpeedMps * 1000) / 1000,
    finishedAt: a.endedAt,
  }
}
