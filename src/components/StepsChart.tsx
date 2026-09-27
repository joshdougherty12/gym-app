import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { shortDate, WEEKDAY_SHORT, weekdayOf, type IsoDate } from '../lib/dates'
import { stepSeries } from '../lib/steps'
import type { DailyLog } from '../types'
import { useChartColors } from './charts'
import { Segmented } from './ui'

/** Progress: daily steps for the last 7 or 30 days as bars, with the goal as a dashed line. */
export function StepsChart({ logs, today, goal }: { logs: readonly DailyLog[]; today: IsoDate; goal: number }) {
  const [range, setRange] = useState<'7' | '30'>('7')
  const c = useChartColors()
  const days = stepSeries(logs, today, Number(range))
  const data = days.map((d) => ({ label: range === '7' ? `${WEEKDAY_SHORT[weekdayOf(d.date)]} ${shortDate(d.date)}` : shortDate(d.date), value: d.steps }))
  const logged = days.filter((d) => d.steps !== undefined)
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + (d.steps ?? 0), 0) / logged.length) : undefined
  const hits = logged.filter((d) => (d.steps ?? 0) >= goal).length
  const hi = Math.max(goal, ...logged.map((d) => d.steps ?? 0))
  const fmt = (v: number) => `${v.toLocaleString()} steps`

  const TooltipBox = ({ active, payload, label }: { active?: boolean; payload?: readonly { value?: unknown }[]; label?: unknown }) => {
    const v = payload?.[0]?.value
    if (!active || typeof v !== 'number') return null
    return (
      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
        <div className="text-xs text-muted">{String(label ?? '')}</div>
        <div className="num text-base font-semibold text-ink">{fmt(v)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Segmented
        label="Step chart range"
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="num text-3xl font-bold">{avg === undefined ? '—' : avg.toLocaleString()}</div>
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Daily average</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="num text-3xl font-bold">{logged.length ? `${hits}/${logged.length}` : '—'}</div>
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Days at goal</div>
        </div>
      </div>
      {logged.length === 0 ? (
        <div className="grid h-32 place-items-center px-4 text-center text-sm text-muted">No steps logged in the last {range} days.</div>
      ) : (
        <figure aria-label={`Daily steps, last ${range} days, goal ${goal.toLocaleString()}`}>
          <div className="mb-1 flex gap-4 text-xs text-muted" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: c.s1 }} />
              Steps
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: c.axis }} />
              Goal {goal.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={16} tickFormatter={(l: string) => (range === '7' ? (l.split(' ')[0] ?? l) : l)} />
                <YAxis
                  domain={[0, Math.ceil((hi * 1.1) / 1000) * 1000]}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={TooltipBox} cursor={{ fill: c.grid, opacity: 0.5 }} />
                <ReferenceLine y={goal} stroke={c.axis} strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="value" name="Steps" fill={c.s1} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-1 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-muted">Show as table</summary>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 font-semibold">Date</th>
                  <th className="py-1 text-right font-semibold">Steps</th>
                </tr>
              </thead>
              <tbody className="num">
                {[...days].reverse().map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="py-1">{shortDate(d.date)}</td>
                    <td className="py-1 text-right">{d.steps === undefined ? '—' : d.steps.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </figure>
      )}
    </div>
  )
}
