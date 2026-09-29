import { useEffect, useState } from 'react'
import { todayIso } from '../lib/dates'

/** Today's local date, updated when the day rolls over (checked each minute and on return to the app). */
export function useToday(): string {
  const [today, setToday] = useState(todayIso)
  useEffect(() => {
    const check = () => setToday(todayIso())
    const t = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
