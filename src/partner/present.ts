import { EventData } from '../lib/partner/types'

/** Words for an incoming high-five, nudge or "I ate this". */
export function eventText(data: unknown, partnerName: string): { title: string; body: string } | null {
  const e = EventData.safeParse(data)
  if (!e.success) return null
  switch (e.data.kind) {
    case 'highfive':
      return { title: `${partnerName} sent you a high-five`, body: 'Nice work.' }
    case 'nudge':
      return { title: `${partnerName} nudged you`, body: 'Time to get a workout in.' }
    case 'atethis':
      return { title: `${partnerName} ate ${e.data.recipe.name}`, body: 'Log it too from the Food screen.' }
  }
}

/** "2 h ago", "yesterday", "3 days ago". */
export function ago(ms: number, now: number): string {
  const m = Math.max(0, Math.round((now - ms) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
