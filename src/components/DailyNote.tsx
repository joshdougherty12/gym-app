import { useEffect, useState } from 'react'
import { todayIso } from '../lib/dates'
import { todaysNote } from '../partner/dailyNote'

const HEART = 'M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4.5 5.8 4.1c2.1-.2 3.9.9 5 2.6 1.1-1.7 2.9-2.8 5-2.6 3.7.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z'

/** Joshua's note of the day, as a speech bubble beside the weekday on Today. Nothing while there is none. */
export function DailyNote() {
  const [note, setNote] = useState<{ day: string; text: string } | null>(null)
  const day = todayIso()

  useEffect(() => {
    let live = true
    void todaysNote().then((text) => {
      if (live && text) setNote({ day, text })
    })
    return () => {
      live = false
    }
  }, [day])

  if (!note || note.day !== day) return null
  return (
    <figure className="daily-note relative mb-1 max-w-[62%] min-w-0 self-center rounded-2xl rounded-bl-md px-3 py-2">
      <svg viewBox="0 0 24 24" className="daily-note-heart absolute -top-2 -right-1.5 size-5 rotate-12" aria-hidden="true">
        <path fill="currentColor" d={HEART} />
      </svg>
      <blockquote className="text-[13px] leading-snug font-medium">{note.text}</blockquote>
      <figcaption className="sr-only">From your hubband</figcaption>
    </figure>
  )
}
