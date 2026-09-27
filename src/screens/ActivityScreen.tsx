import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RouteSvg } from '../components/activity/RouteSvg'
import { useChartColors } from '../components/charts'
import { Icon } from '../components/Icon'
import { Button, Card, Loading, Screen, SectionTitle, Sheet } from '../components/ui'
import { db } from '../db/db'
import { deleteActivity, exportGpx } from '../db/activities'
import { useSettings } from '../db/repo'
import { distUnit, fmtDistance, fmtDuration, fmtElevation, fmtRate } from '../lib/activity/format'
import { ACTIVITY } from '../lib/activity/track'
import { shortDate, WEEKDAY_SHORT, weekdayOf } from '../lib/dates'
import { timestamp } from '../lib/id'
import type { Activity, Units } from '../types'

const RouteMap = lazy(() => import('../components/activity/RouteMap'))

const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function SplitsChart({ a, units }: { a: Activity; units: Units }) {
  const c = useChartColors()
  const showSpeed = ACTIVITY[a.type].showSpeed
  const unit = distUnit(units)
  // Pace (or speed) of each split, normalized to a full mile/km for the partial last one.
  const data = a.splits.map((s) => {
    const mps = s.movingMs > 0 ? s.distanceM / (s.movingMs / 1000) : 0
    return { label: `${s.index}`, value: showSpeed ? (mps * 3600) / (units === 'metric' ? 1000 : 1609.344) : mps > 0 ? (units === 'metric' ? 1000 : 1609.344) / mps / 60 : 0, mps }
  })
  const fmt = (mps: number) => {
    const r = fmtRate(a.type, mps, units)
    return `${r.value} ${r.unit}`
  }
  const TooltipBox = ({ active, payload, label }: { active?: boolean; payload?: readonly { payload?: { mps?: number } }[]; label?: unknown }) => {
    const mps = payload?.[0]?.payload?.mps
    if (!active || typeof mps !== 'number') return null
    return (
      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
        <div className="text-xs text-muted">
          {unit} {String(label ?? '')}
        </div>
        <div className="num text-base font-semibold text-ink">{fmt(mps)}</div>
      </div>
    )
  }
  return (
    <figure aria-label={`${showSpeed ? 'Speed' : 'Pace'} per ${unit === 'mi' ? 'mile' : 'km'}`}>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
            <YAxis
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => (showSpeed ? v.toFixed(0) : `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`)}
            />
            <Tooltip content={TooltipBox} cursor={{ fill: c.grid, opacity: 0.5 }} />
            <Bar dataKey="value" name={showSpeed ? 'Speed' : 'Pace'} fill={c.s1} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-muted">{showSpeed ? `Speed (${fmtRate(a.type, 0, units).unit}) per ${unit === 'mi' ? 'mile' : 'km'}` : `Pace (min${fmtRate(a.type, 1, units).unit}) per ${unit === 'mi' ? 'mile' : 'km'}; lower is faster`}</figcaption>
    </figure>
  )
}

/** One saved activity: map, stats, splits, GPX export, delete. */
export function ActivityScreen() {
  const { id = '' } = useParams()
  const settings = useSettings()
  const a = useLiveQuery(async () => (await db.activities.get(id)) ?? null, [id])
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (a === undefined || !settings) return <Loading />
  if (a === null)
    return (
      <Screen title="Activity" back="/activities">
        <p className="text-muted">This activity was deleted.</p>
      </Screen>
    )
  const u = settings.units
  const unit = distUnit(u)
  const prof = ACTIVITY[a.type]
  const avg = fmtRate(a.type, a.distanceM > 0 ? a.avgSpeedMps : null, u)
  const hasRoute = a.route.some((s) => s.length > 0)
  return (
    <Screen title={prof.label} subtitle={`${WEEKDAY_SHORT[weekdayOf(a.date)]} ${shortDate(a.date)} · ${timeOfDay(a.startedAt)}`} back="/activities">
      {hasRoute ? (
        <Suspense fallback={<RouteSvg route={a.route} className="h-64" />}>
          <RouteMap route={a.route} className="h-64" />
        </Suspense>
      ) : (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">No GPS route was recorded.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Distance</p>
          <p className="num text-4xl leading-none font-bold" data-testid="activity-distance">
            {fmtDistance(a.distanceM, u)}
            <span className="ml-1 text-base text-muted">{unit}</span>
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Moving time</p>
          <p className="num text-4xl leading-none font-bold">{fmtDuration(a.movingMs)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">{prof.showSpeed ? 'Avg speed' : 'Avg pace'}</p>
          <p className="num text-3xl leading-none font-bold">
            {avg.value}
            <span className="ml-1 text-base text-muted">{avg.unit}</span>
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Elapsed</p>
          <p className="num text-3xl leading-none font-bold">{fmtDuration(a.elapsedMs)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Climb (approx.)</p>
          <p className="num text-3xl leading-none font-bold">{a.elevationGainM !== undefined ? fmtElevation(a.elevationGainM, u) : '--'}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Calories (est.)</p>
          <p className="num text-3xl leading-none font-bold">{a.calories !== undefined ? a.calories.toLocaleString() : '--'}</p>
        </div>
      </div>
      {a.calories === undefined && <p className="mt-1 text-xs text-muted">Log your weight to see a calorie estimate.</p>}

      {a.splits.length > 0 && (
        <>
          <SectionTitle>Splits</SectionTitle>
          <Card>
            <SplitsChart a={a} units={u} />
            <table className="mt-2 w-full text-left">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 font-semibold">{unit === 'mi' ? 'Mile' : 'Km'}</th>
                  <th className="py-1 font-semibold">Time</th>
                  <th className="py-1 text-right font-semibold">{prof.showSpeed ? 'Speed' : 'Pace'}</th>
                </tr>
              </thead>
              <tbody className="num text-lg">
                {a.splits.map((s) => {
                  const r = fmtRate(a.type, s.movingMs > 0 ? s.distanceM / (s.movingMs / 1000) : null, u)
                  const partial = s.distanceM < a.splitM - 1
                  return (
                    <tr key={s.index} className="border-t border-line">
                      <td className="py-1">{partial ? `${fmtDistance(s.distanceM, u)}` : s.index}</td>
                      <td className="py-1">{fmtDuration(s.movingMs)}</td>
                      <td className="py-1 text-right">
                        {r.value}
                        <span className="text-sm text-muted">{r.unit}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <div className="mt-4 grid gap-2">
        <Button
          onClick={() =>
            void exportGpx(a).then((r) => setMsg(r === 'failed' ? 'Could not export the GPX file.' : r === 'downloaded' ? 'GPX file downloaded.' : null))
          }
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="share" className="size-5" /> Export GPX
          </span>
        </Button>
        {msg && (
          <p role="status" className="text-center text-sm text-muted">
            {msg}
          </p>
        )}
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete {prof.noun}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">Elevation is approximate (GPS altitude). The route stays on this phone.</p>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${prof.noun}?`}>
        <p className="text-sm">The route, stats and its cardio entry are deleted.</p>
        <div className="mt-3 grid gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setConfirmDelete(false)
              void deleteActivity(a.id).then(() => navigate('/activities', { replace: true }))
            }}
          >
            Delete
          </Button>
          <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
        </div>
      </Sheet>
    </Screen>
  )
}

/** Activity row for lists. */
export function ActivityRow({ a, units }: { a: Activity; units: Units }) {
  const r = fmtRate(a.type, a.distanceM > 0 ? a.avgSpeedMps : null, units)
  return (
    <Link to={`/activity/${a.id}`} className="flex min-h-14 items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {ACTIVITY[a.type].label} <span className="font-normal text-muted">· {WEEKDAY_SHORT[weekdayOf(a.date)]} {shortDate(a.date)}</span>
        </span>
        <span className="num block text-lg">
          {fmtDistance(a.distanceM, units)} {distUnit(units)} · {fmtDuration(a.movingMs)} · {r.value}
          {r.unit}
        </span>
      </span>
      <Icon name="chevronRight" className="size-5 text-muted" />
    </Link>
  )
}

/** Every saved activity, newest first. */
export function ActivitiesScreen() {
  const settings = useSettings()
  const list = useLiveQuery(() => db.activities.orderBy('startedAt').reverse().toArray(), [])
  if (!settings || !list) return <Loading />
  const u = settings.units
  const weekAgo = timestamp() - 7 * 24 * 3600 * 1000
  const week = list.filter((a) => a.startedAt >= weekAgo)
  return (
    <Screen title="Activities" back="/progress">
      <Link to="/activity/track" className="flex min-h-16 items-center justify-center rounded-2xl bg-accent text-xl font-bold tracking-wide text-accent-ink uppercase">
        Start a run or ride
      </Link>
      {week.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Last 7 days: <span className="num text-lg text-ink">{fmtDistance(week.reduce((s, a) => s + a.distanceM, 0), u)}</span> {distUnit(u)} in {week.length}{' '}
          {week.length === 1 ? 'activity' : 'activities'}
        </p>
      )}
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No activities yet. Start one and it shows up here with its map and splits.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((a) => (
            <li key={a.id}>
              <ActivityRow a={a} units={u} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
