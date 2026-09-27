import { useState } from 'react'
import { Link } from 'react-router'
import { mondayOf, shortDate, todayIso, WEEKDAY_SHORT, weekdayOf } from '../../lib/dates'
import { displayWeight, formatNumber, weightUnit } from '../../lib/units'
import { markEventSeen, sendEvent } from '../../partner/engine'
import { usePartner, usePartnerInbox, usePartnerWorkouts } from '../../partner/hooks'
import { ago, eventText } from '../../partner/present'
import { syncNow, useSyncStatus } from '../../partner/useSync'
import type { Units } from '../../types'
import { useToast } from '../Recipes'
import { Badge, Button, Card } from '../ui'
import { Icon } from '../Icon'
import { timestamp } from '../../lib/id'
import { SyncBadge } from './SyncBadge'

/** Today: the partner's workouts this week, their high-fives and nudges, and buttons to send your own. */
export function PartnerCard({ units }: { units: Units }) {
  const p = usePartner()
  const today = todayIso()
  const workouts = usePartnerWorkouts(mondayOf(today))
  const inbox = usePartnerInbox(['highfive', 'nudge'])
  const partnerLeft = useSyncStatus((s) => s.partnerLeft)
  const [toastNode, toast] = useToast()
  // A few seconds between sends, so a double tap sends one.
  const [cooling, setCooling] = useState(false)
  if (!p) return null
  if (!p.link) {
    if (!partnerLeft) return null
    return (
      <Card className="mt-3">
        <p className="text-sm">The partner link was ended. Everything you had stays on this phone.</p>
      </Card>
    )
  }
  if (p.link.status === 'waiting') {
    return (
      <Link to="/settings" className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-4">
        <Icon name="users" className="size-5 text-accent" />
        <span className="flex-1 text-sm font-semibold">Waiting for your partner to link</span>
        <Icon name="chevronRight" className="size-5 text-muted" />
      </Link>
    )
  }
  const name = p.partnerName
  const fmt = (lb: number, added: boolean) => `${added ? '+' : ''}${formatNumber(displayWeight(lb, units))} ${weightUnit(units)}`
  const send = (kind: 'highfive' | 'nudge', workoutId?: string) => {
    setCooling(true)
    window.setTimeout(() => setCooling(false), 3000)
    void sendEvent(kind === 'highfive' ? { kind, at: timestamp(), ...(workoutId ? { workoutId } : {}) } : { kind, at: timestamp() }).then((ok) => {
      toast(ok ? (kind === 'highfive' ? `High-five sent to ${name}` : `Nudge sent to ${name}`) : 'Not linked')
      void syncNow()
    })
  }
  const latest = workouts?.[0]
  return (
    <Card className="mt-3">
      <div className="flex items-center gap-2">
        <Icon name="users" className="size-5 text-accent" />
        <p className="flex-1 text-xs font-bold tracking-[0.14em] text-muted uppercase">{name}</p>
        <SyncBadge />
      </div>

      {inbox?.map((e) => {
        const text = eventText(e.data, name)
        return (
          <div key={e.row.key} role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-accent-soft p-2 pl-3">
            <Icon name={e.data.kind === 'nudge' ? 'bell' : 'hand'} className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{text?.title}</span> <span className="text-muted">· {ago(e.data.at, timestamp())}</span>
            </span>
            <Button variant="ghost" onClick={() => void markEventSeen(e.row.key)}>
              OK
            </Button>
          </div>
        )
      })}

      {p.partner && !p.partner.sharesWorkouts ? (
        <p className="mt-2 text-sm text-muted">{name} isn’t sharing workouts.</p>
      ) : workouts && workouts.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {workouts.slice(0, 3).map((w) => (
            <li key={w.key} className="rounded-xl bg-surface-2 p-3">
              <p className="font-semibold">
                {w.data.name} <span className="font-normal text-muted">· {w.data.date === today ? 'today' : `${WEEKDAY_SHORT[weekdayOf(w.data.date)]} ${shortDate(w.data.date)}`}</span>
              </p>
              <p className="num text-lg">
                {w.data.minutes} min · {w.data.setsDone} sets
              </p>
              {w.data.prs.length > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-sm">
                  <Badge tone="accent">{w.data.prs.length} PR{w.data.prs.length === 1 ? '' : 's'}</Badge>
                  {[...new Set(w.data.prs.map((x) => x.exercise))].join(', ')}
                </p>
              )}
              {w.data.best.length > 0 && <p className="mt-1 text-sm text-muted">{w.data.best.map((b) => `${b.exercise} ${fmt(b.weightLb, b.addedLoad)} × ${b.reps}`).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No workouts from {name} yet this week.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="primary" disabled={cooling} onClick={() => send('highfive', latest?.id)}>
          <span className="inline-flex items-center gap-2">
            <Icon name="hand" className="size-5" /> High-five
          </span>
        </Button>
        <Button disabled={cooling} onClick={() => send('nudge')}>
          <span className="inline-flex items-center gap-2">
            <Icon name="bell" className="size-5" /> Nudge
          </span>
        </Button>
      </div>
      {toastNode}
    </Card>
  )
}
