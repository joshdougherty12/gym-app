import type { ActivityType, Units } from '../../types'
import { ACTIVITY, METERS_PER_MILE } from './track'

export const splitMeters = (units: Units): number => (units === 'metric' ? 1000 : METERS_PER_MILE)
export const distUnit = (units: Units): 'mi' | 'km' => (units === 'metric' ? 'km' : 'mi')
export const speedUnit = (units: Units): 'mph' | 'km/h' => (units === 'metric' ? 'km/h' : 'mph')
export const paceUnit = (units: Units): '/mi' | '/km' => (units === 'metric' ? '/km' : '/mi')

/** Distance in miles or km, 2 decimals: "1.24". */
export function fmtDistance(m: number, units: Units): string {
  return (Math.floor((m / splitMeters(units)) * 100) / 100).toFixed(2)
}

/** "12:03" or "1:02:03". */
export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

/** Pace per mile or km, "8:05"; "--:--" when (nearly) stopped or unknown. */
export function fmtPace(speedMps: number | null, units: Units): string {
  if (speedMps === null || speedMps < 0.3) return '--:--'
  const secPer = splitMeters(units) / speedMps
  if (secPer >= 100 * 60) return '--:--'
  return fmtDuration(secPer * 1000)
}

/** Speed in mph or km/h, one decimal. */
export function fmtSpeed(speedMps: number | null, units: Units): string {
  if (speedMps === null) return '--'
  return ((speedMps * 3600) / splitMeters(units)).toFixed(1)
}

/** Pace or speed, whichever the activity shows, with its unit. */
export function fmtRate(type: ActivityType, speedMps: number | null, units: Units): { value: string; unit: string } {
  return ACTIVITY[type].showSpeed ? { value: fmtSpeed(speedMps, units), unit: speedUnit(units) } : { value: fmtPace(speedMps, units), unit: paceUnit(units) }
}

/** Elevation in ft or m, whole numbers. */
export function fmtElevation(m: number, units: Units): string {
  return units === 'metric' ? `${Math.round(m)} m` : `${Math.round(m * 3.28084)} ft`
}
