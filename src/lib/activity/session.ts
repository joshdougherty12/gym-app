import type { ActiveActivity, ActivityType, TrackEvent } from '../../types'
import { isPausedAt } from './track'

// Pure rules for starting, pausing and recovering an activity in progress.

const TYPES: readonly ActivityType[] = ['run', 'walk', 'bike', 'hike']

/** Add a pause or resume if it changes the state (a double tap adds nothing). */
export function withEvent(events: readonly TrackEvent[], kind: 'pause' | 'resume', t: number): TrackEvent[] {
  const paused = isPausedAt(events, Number.MAX_SAFE_INTEGER)
  if ((kind === 'pause') === paused) return [...events]
  return [...events, { t: Math.max(t, events[events.length - 1]?.t ?? t), kind }]
}

/**
 * The web app was reloaded (or reopened) mid-activity: fixes stopped while it
 * was gone, so a gap starts a new segment (no straight line across the gap).
 * A paused activity needs none: resuming starts a new segment anyway.
 */
export function recoverWebSession(s: ActiveActivity, now: number): ActiveActivity {
  if (isPausedAt(s.events, now)) return s
  return { ...s, events: [...s.events, { t: Math.max(now, s.events[s.events.length - 1]?.t ?? now), kind: 'gap' }] }
}

/** What the app does on opening with an Android session on record. */
export type NativeRecovery = 'none' | 'save' | 'restart' | 'continue'

export function nativeRecovery(ns: { active: boolean; running: boolean; endedAt?: number }): NativeRecovery {
  if (!ns.active) return 'none'
  // Stopped but not saved (the app closed between Finish and saving): save it now.
  if (ns.endedAt !== undefined) return 'save'
  return ns.running ? 'continue' : 'restart'
}

/** The session header from what the Android side reports; null if it is incomplete. */
export function sessionFromNative(ns: {
  id?: string
  type?: string
  startedAt?: number
  autoPause?: boolean
  splitCue?: boolean
  splitM?: number
  events: TrackEvent[]
}): ActiveActivity | null {
  if (!ns.id || !ns.type || !TYPES.includes(ns.type as ActivityType) || typeof ns.startedAt !== 'number') return null
  return {
    id: 'current',
    activityId: ns.id,
    type: ns.type as ActivityType,
    startedAt: ns.startedAt,
    source: 'android',
    events: ns.events.filter((e) => e.kind === 'pause' || e.kind === 'resume' || e.kind === 'gap'),
    autoPause: ns.autoPause ?? true,
    splitCue: ns.splitCue ?? false,
    splitM: ns.splitM && ns.splitM > 0 ? ns.splitM : 1609.344,
  }
}
