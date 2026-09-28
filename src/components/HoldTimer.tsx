import { useEffect, useRef, useState } from 'react'
import { useWakeLock } from '../hooks/useWakeLock'
import { buzz, cueTone, primeAudio } from '../lib/alarm'
import { formatHold, holdCues, holdView, IDLE, startHold, stopHold, type HoldState, type HoldView } from '../lib/holdTimer'

const R = 88
const C = 2 * Math.PI * R
const TICKS = Array.from({ length: 60 }, (_, i) => i)

const LABEL: Record<HoldView['phase'], string> = {
  idle: 'Ready',
  'get-set': 'Get set',
  switch: 'Switch sides',
  hold: 'Hold',
  done: 'Held',
}

/**
 * A big stopwatch ring for timed holds. Tap the ring (or the button) to start:
 * 3-2-1, then it counts up and fills toward the target, turns green with a
 * chime at the target and keeps counting until Stop. Per-side holds run left,
 * a 5-second switch, then right. The screen stays on while it runs.
 */
export function HoldTimer({
  targetSec,
  perSide,
  sound,
  vibrate,
  onResult,
}: {
  targetSec: number
  perSide: boolean
  sound: boolean
  vibrate: boolean
  onResult: (seconds: number) => void
}) {
  const [state, setState] = useState<HoldState>(IDLE)
  const [now, setNow] = useState(() => Date.now())
  const running = state.kind === 'running'
  const view = holdView(state, now, targetSec)
  const prevView = useRef(view)
  useWakeLock(running)

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(t)
  }, [running])

  useEffect(() => {
    for (const cue of holdCues(prevView.current, view)) {
      if (sound) cueTone(cue)
      if (vibrate) buzz(cue === 'tick' ? 40 : cue === 'target' ? [200, 80, 200, 80, 400] : 150)
    }
    prevView.current = view
  })

  const tap = () => {
    const t = Date.now()
    primeAudio()
    setNow(t)
    if (state.kind === 'idle') return setState(startHold(t, perSide))
    if (state.kind === 'done') return setState(IDLE)
    const next = stopHold(state, t)
    setState(next)
    if (next.kind === 'done') onResult(next.seconds)
  }

  const counting = view.phase === 'get-set' || view.phase === 'switch'
  const over = view.elapsed - targetSec
  const ringColor = view.reachedTarget ? 'var(--good)' : 'var(--accent)'
  const sideText = view.side ? (view.side === 'left' ? 'Left side' : 'Right side') : null
  const doneSides = state.kind === 'done' && state.leftSec !== undefined ? `L ${formatHold(state.leftSec)} · R ${formatHold(state.rightSec ?? 0)}` : null

  const action =
    view.phase === 'idle'
      ? 'Start'
      : counting
        ? 'Cancel'
        : view.phase === 'hold'
          ? view.side === 'left'
            ? 'Done, switch sides'
            : 'Stop'
          : 'Redo'

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <button
        type="button"
        onClick={tap}
        aria-label={`${action}. ${LABEL[view.phase]}${sideText ? `, ${sideText}` : ''}. Target ${formatHold(targetSec)}.`}
        className="relative grid size-56 place-items-center rounded-full"
      >
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          {TICKS.map((i) => (
            <line
              key={i}
              x1="100"
              y1={i % 5 === 0 ? 3 : 5}
              x2="100"
              y2="9"
              stroke="var(--line)"
              strokeWidth={i % 5 === 0 ? 2 : 1}
              transform={`rotate(${i * 6} 100 100)`}
            />
          ))}
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
          {counting ? (
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--warn)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(C * view.countdown) / (view.phase === 'switch' ? 5 : 3)} ${C}`}
              className="transition-[stroke-dasharray] duration-300"
            />
          ) : (
            view.progress > 0 && (
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${C * view.progress} ${C}`}
              />
            )
          )}
        </svg>
        <span className="relative flex flex-col items-center">
          <span className={`text-xs font-bold tracking-[0.16em] uppercase ${counting ? 'text-warn' : view.reachedTarget ? 'text-good' : 'text-muted'}`}>
            {sideText && view.phase !== 'done' ? `${LABEL[view.phase]} · ${sideText}` : LABEL[view.phase]}
          </span>
          <span className={`num leading-none font-bold ${counting ? 'text-7xl text-warn' : 'text-6xl'}`}>{counting ? view.countdown : formatHold(view.elapsed)}</span>
          <span className={`num mt-1 text-lg ${view.reachedTarget ? 'text-good' : 'text-muted'}`}>
            {view.phase === 'idle' ? `target ${formatHold(targetSec)}` : view.reachedTarget ? (over > 0 ? `+${formatHold(over)} over` : 'target hit') : `of ${formatHold(targetSec)}`}
          </span>
        </span>
      </button>
      {doneSides && <p className="num text-base text-muted">{doneSides}</p>}
      <p className="sr-only" aria-live="polite">
        {view.phase === 'hold' ? (view.reachedTarget ? 'Target reached' : sideText ? `Hold, ${sideText}` : 'Hold') : view.phase === 'switch' ? 'Switch sides' : view.phase === 'done' ? `Held ${view.elapsed} seconds` : ''}
      </p>
      <button
        type="button"
        onClick={tap}
        className={`min-h-12 w-full rounded-xl text-base font-bold tracking-wide uppercase ${
          view.phase === 'hold' ? 'bg-ink text-bg' : view.phase === 'idle' ? 'bg-accent-soft text-accent' : 'border border-line bg-surface-2 text-ink'
        }`}
      >
        {action}
      </button>
    </div>
  )
}
