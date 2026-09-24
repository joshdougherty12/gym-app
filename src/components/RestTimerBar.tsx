import { useEffect, useRef, useState } from 'react'
import { beep, vibrate } from '../lib/alarm'
import { formatRest } from '../lib/rest'
import { useRestTimer } from '../store/restTimer'

/** Sticky rest timer. Rings once when it reaches zero, then clears itself. */
export function RestTimerBar({ sound, vibration }: { sound: boolean; vibration: boolean }) {
  const { endsAt, totalSec, label, adjust, skip } = useRestTimer()
  const [now, setNow] = useState(() => Date.now())
  const rang = useRef<number | null>(null)

  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  const left = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))

  useEffect(() => {
    if (endsAt === null || left > 0 || rang.current === endsAt) return
    rang.current = endsAt
    if (sound) beep()
    if (vibration) vibrate()
    const id = window.setTimeout(skip, 4000)
    return () => window.clearTimeout(id)
  }, [endsAt, left, sound, vibration, skip])

  if (endsAt === null) return null
  const done = left === 0
  const pct = totalSec > 0 ? Math.min(100, ((totalSec - left) / totalSec) * 100) : 100

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Rest ${formatRest(left)} remaining`}
      className={`fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] ${done ? 'border-good bg-good text-bg' : 'border-line bg-surface'}`}
    >
      {!done && <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />}
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-bold tracking-[0.14em] uppercase ${done ? '' : 'text-muted'}`}>{done ? 'Rest over, go' : `Rest · ${label}`}</div>
          <div className="num text-5xl leading-none font-bold">{formatRest(left)}</div>
        </div>
        {!done && (
          <>
            <button type="button" onClick={() => adjust(-15)} className="num min-h-12 min-w-12 rounded-xl bg-surface-2 px-2 text-xl font-bold" aria-label="15 seconds less">
              −15
            </button>
            <button type="button" onClick={() => adjust(15)} className="num min-h-12 min-w-12 rounded-xl bg-surface-2 px-2 text-xl font-bold" aria-label="15 seconds more">
              +15
            </button>
          </>
        )}
        <button type="button" onClick={skip} className={`min-h-12 rounded-xl px-4 font-bold ${done ? 'bg-bg text-good' : 'bg-accent text-accent-ink'}`}>
          {done ? 'OK' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
