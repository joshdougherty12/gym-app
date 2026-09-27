import { lazy, Suspense } from 'react'
import { useParams } from 'react-router'
import { RouteSvg } from '../components/activity/RouteSvg'
import { Card, Loading, Screen, SectionTitle } from '../components/ui'
import { useSettings } from '../db/repo'
import { distUnit, fmtDistance, fmtDuration, fmtRate } from '../lib/activity/format'
import { ACTIVITY } from '../lib/activity/track'
import { routeForMap } from '../lib/partner/activityRoute'
import { shortDate, WEEKDAY_SHORT, weekdayOf } from '../lib/dates'
import { usePartner, usePartnerActivity } from '../partner/hooks'

const RouteMap = lazy(() => import('../components/activity/RouteMap'))

const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** A partner's shared run, walk or ride: read-only. The map appears only when they share routes (last 30 days). */
export function PartnerActivityScreen() {
  const { id = '' } = useParams()
  const p = usePartner()
  const detail = usePartnerActivity(id)
  const settings = useSettings()
  if (p === undefined || detail === undefined || !settings) return <Loading />
  const name = p.partnerName
  if (!detail) {
    return (
      <Screen title={`${name}’s activity`} back="/">
        <p className="text-sm text-muted">This activity isn’t shared anymore.</p>
      </Screen>
    )
  }
  const { summary: s, route } = detail
  const u = settings.units
  const unit = distUnit(u)
  const prof = ACTIVITY[s.type]
  const avg = fmtRate(s.type, s.distanceM > 0 ? s.avgSpeedMps : null, u)
  const mapRoute = route ? routeForMap(route.segments) : null
  const hasRoute = !!mapRoute && mapRoute.some((seg) => seg.length > 0)
  const started = route?.startedAt

  return (
    <Screen title={`${name}’s ${prof.noun}`} subtitle={`${WEEKDAY_SHORT[weekdayOf(s.date)]} ${shortDate(s.date)}${started ? ` · ${timeOfDay(started)}` : ''}`} back="/">
      {hasRoute && mapRoute ? (
        <Suspense fallback={<RouteSvg route={mapRoute} className="h-64" />}>
          <RouteMap route={mapRoute} className="h-64" />
        </Suspense>
      ) : (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{name} shares the summary of this {prof.noun}, not the route.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Distance</p>
          <p className="num text-4xl leading-none font-bold">
            {fmtDistance(s.distanceM, u)}
            <span className="ml-1 text-base text-muted">{unit}</span>
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Moving time</p>
          <p className="num text-4xl leading-none font-bold">{fmtDuration(s.movingMs)}</p>
        </div>
        <div className="col-span-2 rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">{prof.showSpeed ? 'Avg speed' : 'Avg pace'}</p>
          <p className="num text-3xl leading-none font-bold">
            {avg.value}
            <span className="ml-1 text-base text-muted">{avg.unit}</span>
          </p>
        </div>
      </div>

      {route && route.splits.length > 0 && (
        <>
          <SectionTitle>Splits</SectionTitle>
          <Card>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 font-semibold">{unit === 'mi' ? 'Mile' : 'Km'}</th>
                  <th className="py-1 font-semibold">Time</th>
                  <th className="py-1 text-right font-semibold">{prof.showSpeed ? 'Speed' : 'Pace'}</th>
                </tr>
              </thead>
              <tbody className="num text-lg">
                {route.splits.map((sp) => {
                  const r = fmtRate(s.type, sp.movingMs > 0 ? sp.distanceM / (sp.movingMs / 1000) : null, u)
                  const partial = sp.distanceM < route.splitM - 1
                  return (
                    <tr key={sp.index} className="border-t border-line">
                      <td className="py-1">{partial ? fmtDistance(sp.distanceM, u) : sp.index}</td>
                      <td className="py-1">{fmtDuration(sp.movingMs)}</td>
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
      <p className="mt-3 text-xs text-muted">Shared by {name}. Routes are shared for 30 days, then only the summary stays.</p>
    </Screen>
  )
}
