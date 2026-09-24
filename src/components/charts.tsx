import { useEffect, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface ChartColors {
  s1: string
  s2: string
  grid: string
  axis: string
  surface: string
  ink: string
  muted: string
}

function readColors(): ChartColors {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => cs.getPropertyValue(n).trim()
  return { s1: v('--chart-1'), s2: v('--chart-2'), grid: v('--chart-grid'), axis: v('--chart-axis'), surface: v('--surface'), ink: v('--ink'), muted: v('--ink-muted') }
}

/** Chart colors from the CSS tokens, re-read when the theme flips. */
export function useChartColors(): ChartColors {
  const [c, setC] = useState(readColors)
  useEffect(() => {
    const mo = new MutationObserver(() => setC(readColors()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return c
}

export interface Series {
  key: string
  name: string
  color: 's1' | 's2'
  /** Show only the markers (raw readings) instead of a line. */
  dotsOnly?: boolean
}

type Row = { label: string } & Record<string, number | string | undefined>

/**
 * Single-axis line chart with a crosshair tooltip. Two series max; a legend
 * appears for two. A table of the same data sits underneath for accessibility.
 */
export function TrendChart({
  title,
  data,
  series,
  format,
  height = 200,
  empty,
}: {
  title: string
  data: Row[]
  series: Series[]
  format: (v: number) => string
  height?: number
  empty: ReactNode
}) {
  const c = useChartColors()
  if (data.length === 0) return <div className="grid h-32 place-items-center px-4 text-center text-sm text-muted">{empty}</div>

  const values = data.flatMap((d) => series.map((s) => d[s.key]).filter((v): v is number => typeof v === 'number'))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max(1, (hi - lo) * 0.15)

  const TooltipBox = ({ active, payload, label }: { active?: boolean; payload?: readonly { dataKey?: unknown; value?: unknown }[]; label?: unknown }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
        <div className="text-xs text-muted">{String(label ?? '')}</div>
        {payload.map((p, i) => {
          const s = series.find((x) => x.key === p.dataKey)
          if (!s || typeof p.value !== 'number') return null
          return (
            <div key={s.key + i} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: c[s.color] }} />
              <span className="text-muted">{s.name}</span>
              <span className="num ml-auto text-base font-semibold text-ink">{format(p.value)}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <figure aria-label={title}>
      {series.length > 1 && (
        <div className="mb-1 flex gap-4 text-xs text-muted" aria-hidden="true">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={s.dotsOnly ? 'size-2.5 rounded-full' : 'h-0.5 w-4 rounded-full'} style={{ background: c[s.color] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={24} />
            <YAxis
              domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip content={TooltipBox} cursor={{ stroke: c.axis, strokeWidth: 1, strokeDasharray: '3 3' }} />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                type="monotone"
                stroke={s.dotsOnly ? 'transparent' : c[s.color]}
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={s.dotsOnly || data.length < 12 ? { r: 4, fill: c[s.color], stroke: c.surface, strokeWidth: 2 } : false}
                activeDot={{ r: 6, fill: c[s.color], stroke: c.surface, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-1 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-muted">Show as table</summary>
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs text-muted">
              <th className="py-1 font-semibold">Date</th>
              {series.map((s) => (
                <th key={s.key} className="py-1 text-right font-semibold">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {[...data].reverse().map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {typeof d[s.key] === 'number' ? format(d[s.key] as number) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Horizontal bar with an optional target tick; plain HTML so it stays crisp and accessible. */
export function TargetBar({ label, value, max, target, display, tone = 'accent' }: { label: string; value: number; max: number; target?: number; display: string; tone?: 'accent' | 'warn' | 'good' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const tpct = target !== undefined && max > 0 ? Math.min(100, (target / max) * 100) : undefined
  const fill = { accent: 'bg-accent', warn: 'bg-warn', good: 'bg-good' }[tone]
  return (
    <div className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-sm">
      <span className="truncate">{label}</span>
      <span className="relative h-3 rounded-full bg-surface-2" role="img" aria-label={`${label}: ${display}${target !== undefined ? ` of ${target}` : ''}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
        {tpct !== undefined && <span className="absolute -inset-y-1 w-0.5 rounded-full bg-ink/70" style={{ left: `${tpct}%` }} />}
      </span>
      <span className="num text-right text-base">{display}</span>
    </div>
  )
}
