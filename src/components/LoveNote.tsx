import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../db/repo'
import { todayIso } from '../lib/dates'
import { isLoveNotePhone, loveNoteDue } from '../lib/loveNote'
import { usePartner } from '../partner/hooks'

const KEY = 'love-note-shown'
const HEART = 'M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4.5 5.8 4.1c2.1-.2 3.9.9 5 2.6 1.1-1.7 2.9-2.8 5-2.6 3.7.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z'
/** Hearts drifting up behind the note: left %, size px, seconds per rise, delay. */
const FLOATERS = [
  [6, 18, 9, 0],
  [14, 30, 12, 3],
  [24, 14, 8, 1.5],
  [33, 24, 11, 5],
  [45, 16, 10, 0.5],
  [55, 34, 13, 2.5],
  [64, 20, 9, 4],
  [73, 14, 8, 1],
  [82, 28, 12, 3.5],
  [91, 18, 10, 0.8],
  [40, 12, 7, 6],
  [78, 22, 11, 6.5],
] as const

function lastShown(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function markShown(day: string): void {
  try {
    localStorage.setItem(KEY, day)
  } catch {
    /* storage unavailable: it may show again, which is fine */
  }
}

/** Joshua's note for Sophie: full screen on her first open of the day, tap to close. */
export function LoveNote() {
  const settings = useSettings()
  const partner = usePartner()
  // Decided once, on the first render with settings and the partner link loaded.
  const [status, setStatus] = useState<'unknown' | 'open' | 'closed'>('unknown')
  const [leaving, setLeaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  if (status === 'unknown' && settings && partner) {
    const myName = settings.partner.name.trim() || settings.profile?.name?.trim()
    const linked = partner.link?.status === 'linked'
    setStatus(isLoveNotePhone(myName, partner.partner?.name, linked) && loveNoteDue(lastShown(), todayIso()) ? 'open' : 'closed')
  }
  const open = status === 'open'

  useEffect(() => {
    if (!open) return
    markShown(todayIso())
    closeRef.current?.focus()
  }, [open])

  if (!open) return null
  const close = () => {
    setLeaving(true)
    window.setTimeout(() => setStatus('closed'), 350)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="love-note-title"
      onClick={close}
      onKeyDown={(e) => e.key === 'Escape' && close()}
      className={`love-note fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-8 text-center transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      {FLOATERS.map(([left, size, secs, delay], i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="love-float"
          style={{ left: `${left}%`, width: size, height: size, animationDuration: `${secs}s`, animationDelay: `${delay}s` }}
          aria-hidden="true"
        >
          <path fill="currentColor" d={HEART} />
        </svg>
      ))}
      <svg viewBox="0 0 24 24" className="love-heart relative size-28" aria-hidden="true">
        <path fill="currentColor" d={HEART} />
      </svg>
      <h1 id="love-note-title" className="relative num text-5xl leading-none font-bold uppercase">
        Hi sweetheart
      </h1>
      <p className="relative max-w-xs text-xl leading-snug">
        I just wanted to say <strong className="love-strong">I LOVE YOU!</strong>
      </p>
      <p className="relative max-w-xs text-xl">Enjoy your workout!</p>
      <p className="relative num text-3xl">-Hubband :)</p>
      <button ref={closeRef} type="button" onClick={close} className="relative love-button mt-4 min-h-12 rounded-full px-8 text-base font-bold tracking-wide uppercase">
        Love you too
      </button>
    </div>
  )
}
