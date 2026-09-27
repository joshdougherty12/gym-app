import { routeBounds } from '../../lib/activity/route'
import type { RoutePoint } from '../../types'

/** The route as a plain line on a grid: used when map tiles can't load (offline). */
export function RouteSvg({ route, className = '' }: { route: RoutePoint[][]; className?: string }) {
  const b = routeBounds(route)
  const W = 400
  const H = 260
  const pad = 16
  let paths: string[] = []
  let start: [number, number] | null = null
  let end: [number, number] | null = null
  if (b) {
    const cos = Math.cos((((b.minLat + b.maxLat) / 2) * Math.PI) / 180)
    const w = Math.max((b.maxLon - b.minLon) * cos, 1e-9)
    const h = Math.max(b.maxLat - b.minLat, 1e-9)
    const scale = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h)
    const ox = (W - w * scale) / 2
    const oy = (H - h * scale) / 2
    const xy = (lat: number, lon: number): [number, number] => [ox + (lon - b.minLon) * cos * scale, H - (oy + (lat - b.minLat) * scale)]
    paths = route.filter((s) => s.length).map((s) => s.map(([, lat, lon], i) => `${i ? 'L' : 'M'}${xy(lat, lon).map((v) => v.toFixed(1)).join(' ')}`).join(''))
    const first = route.find((s) => s.length)?.[0]
    const lastSeg = [...route].reverse().find((s) => s.length)
    const last = lastSeg?.[lastSeg.length - 1]
    if (first) start = xy(first[1], first[2])
    if (last) end = xy(last[1], last[2])
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Route (map unavailable offline)" className={`w-full rounded-xl bg-surface-2 ${className}`}>
      <defs>
        <pattern id="route-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity="0.08" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#route-grid)" className="text-ink" />
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {start && <circle cx={start[0]} cy={start[1]} r="6" fill="var(--good)" stroke="white" strokeWidth="2" />}
      {end && <circle cx={end[0]} cy={end[1]} r="6" fill="var(--bad)" stroke="white" strokeWidth="2" />}
      {!b && (
        <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-current text-muted" fontSize="14">
          No GPS points yet
        </text>
      )}
    </svg>
  )
}
