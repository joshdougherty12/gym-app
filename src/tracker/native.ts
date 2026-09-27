import { registerPlugin } from '@capacitor/core'
import type { ActivityType, TrackEvent, TrackPoint } from '../types'

export type LocationPermission = 'granted' | 'coarse' | 'denied' | 'prompt'

export interface LocationStatus {
  /** 'coarse' = only approximate location allowed (GPS tracking needs precise). */
  permission: LocationPermission
  /** The phone's Location setting is on. */
  gpsOn: boolean
}

/** The session as the Android side keeps it (a file, so it survives the web view or the app being restarted). */
export interface NativeSession {
  active: boolean
  /** The foreground service is running and listening to GPS. */
  running: boolean
  id?: string
  type?: ActivityType
  startedAt?: number
  endedAt?: number
  autoPause?: boolean
  splitCue?: boolean
  splitM?: number
  events: TrackEvent[]
  pointCount: number
}

export interface StartOptions {
  id: string
  type: ActivityType
  startedAt: number
  autoPause: boolean
  splitCue: boolean
  splitM: number
  /** "mi" or "km" for the notification. */
  unit: 'mi' | 'km'
  /** "run", "ride"... for "Tracking run". */
  noun: string
}

interface ActivityTrackerPlugin {
  checkLocation(): Promise<LocationStatus>
  requestLocation(): Promise<LocationStatus>
  openLocationSettings(): Promise<void>
  openAppSettings(): Promise<void>
  start(o: StartOptions): Promise<NativeSession>
  pause(): Promise<NativeSession>
  resume(): Promise<NativeSession>
  /** Stop tracking and mark the session ended; the fixes stay until clear(). */
  stop(): Promise<NativeSession>
  getSession(): Promise<NativeSession>
  getPoints(o: { from: number }): Promise<{ points: TrackPoint[] }>
  /** Restart the service for an active session that lost it (app killed); adds a gap. */
  ensureRunning(): Promise<NativeSession>
  clear(): Promise<void>
}

// Implemented in android/app/src/main/java/com/joshdougherty/cutline/activity/ActivityTrackerPlugin.java.
export const ActivityTracker = registerPlugin<ActivityTrackerPlugin>('ActivityTracker')
