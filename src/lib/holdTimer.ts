/**
 * The hold timer for timed exercises (planks, hollow holds, side planks).
 * Start → a 3-second "get set" countdown → the hold counts up past the target
 * until Stop. Per-side holds run left, then a 5-second switch, then right, and
 * log the weaker side. Everything is derived from timestamps, so a slow or
 * paused render never loses time.
 */

export const GET_READY_SEC = 3
export const SWITCH_SEC = 5

export type HoldSide = 'left' | 'right'

export type HoldState =
  | { kind: 'idle' }
  /** `holdAt`: when the hold starts (after the get-set or switch countdown). */
  | { kind: 'running'; holdAt: number; side: HoldSide | null; leftSec?: number }
  | { kind: 'done'; seconds: number; leftSec?: number; rightSec?: number }

export type HoldPhase = 'idle' | 'get-set' | 'switch' | 'hold' | 'done'

export interface HoldView {
  phase: HoldPhase
  side: HoldSide | null
  /** Whole seconds left in the get-set or switch countdown. */
  countdown: number
  /** Whole seconds held so far (or the result when done). */
  elapsed: number
  /** Ring fill, 0-1, toward the target. */
  progress: number
  reachedTarget: boolean
}

export const IDLE: HoldState = { kind: 'idle' }

export function startHold(now: number, perSide: boolean): HoldState {
  return { kind: 'running', holdAt: now + GET_READY_SEC * 1000, side: perSide ? 'left' : null }
}

/** Stop the hold (or cancel a countdown). Per-side: stopping the left side starts the switch. */
export function stopHold(s: HoldState, now: number): HoldState {
  if (s.kind !== 'running') return s
  if (now < s.holdAt) {
    // Cancelled during a countdown. Mid-switch, the left side still counts; the right side is 0.
    return s.leftSec === undefined ? IDLE : { kind: 'done', seconds: 0, leftSec: s.leftSec, rightSec: 0 }
  }
  const held = Math.floor((now - s.holdAt) / 1000)
  if (s.side === 'left') return { kind: 'running', holdAt: now + SWITCH_SEC * 1000, side: 'right', leftSec: held }
  if (s.side === 'right') return { kind: 'done', seconds: Math.min(s.leftSec ?? held, held), leftSec: s.leftSec ?? held, rightSec: held }
  return { kind: 'done', seconds: held }
}

export function holdView(s: HoldState, now: number, targetSec: number): HoldView {
  const target = Math.max(1, targetSec)
  if (s.kind === 'idle') return { phase: 'idle', side: null, countdown: 0, elapsed: 0, progress: 0, reachedTarget: false }
  if (s.kind === 'done') {
    return { phase: 'done', side: null, countdown: 0, elapsed: s.seconds, progress: Math.min(1, s.seconds / target), reachedTarget: s.seconds >= target }
  }
  if (now < s.holdAt) {
    return {
      phase: s.leftSec === undefined ? 'get-set' : 'switch',
      side: s.side,
      countdown: Math.ceil((s.holdAt - now) / 1000),
      elapsed: 0,
      progress: 0,
      reachedTarget: false,
    }
  }
  const exact = (now - s.holdAt) / 1000
  const elapsed = Math.floor(exact)
  return { phase: 'hold', side: s.side, countdown: 0, elapsed, progress: Math.min(1, exact / target), reachedTarget: elapsed >= target }
}

export type HoldCue = 'tick' | 'go' | 'target' | 'switch'

/** Sounds to play between two views of the same timer: countdown ticks, go, target reached, switch sides. */
export function holdCues(prev: HoldView, next: HoldView): HoldCue[] {
  const out: HoldCue[] = []
  if (next.phase === 'switch' && prev.phase === 'hold') out.push('switch')
  if ((next.phase === 'get-set' || next.phase === 'switch') && next.countdown <= 3 && next.countdown !== prev.countdown) out.push('tick')
  if (next.phase === 'hold' && prev.phase !== 'hold') out.push('go')
  if (next.phase === 'hold' && next.reachedTarget && !(prev.phase === 'hold' && prev.reachedTarget)) out.push('target')
  return out
}

/** "0:45", "1:05". */
export function formatHold(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
