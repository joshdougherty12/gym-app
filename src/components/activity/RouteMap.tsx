import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { MAP_TILES } from '../../lib/activity/mapConfig'
import type { RoutePoint } from '../../types'
import { RouteSvg } from './RouteSvg'

const css = (name: string, fallback: string) => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}

/**
 * The route on an OpenStreetMap map (Leaflet). `live`: follow the newest
 * point (until the user drags the map; "Follow" turns it back on). Falls back
 * to a plain line on a grid when tiles can't load (offline).
 */
export default function RouteMap({ route, live = false, className = 'h-64' }: { route: RoutePoint[][]; live?: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const lines = useRef<L.LayerGroup | null>(null)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const [follow, setFollow] = useState(true)
  const followRef = useRef(true)
  const fitted = useRef(false)

  useEffect(() => {
    if (offline || !el.current || map.current) return
    const m = L.map(el.current, { zoomControl: !live, attributionControl: true })
    m.setView([0, 0], 2)
    let loaded = 0
    let errors = 0
    L.tileLayer(MAP_TILES.url, { maxZoom: MAP_TILES.maxZoom, attribution: MAP_TILES.attribution })
      .on('tileload', () => loaded++)
      .on('tileerror', () => {
        errors++
        if (loaded === 0 && errors >= 3) setOffline(true)
      })
      .addTo(m)
    m.attributionControl.setPrefix(false)
    m.on('dragstart', () => {
      followRef.current = false
      setFollow(false)
    })
    lines.current = L.layerGroup().addTo(m)
    map.current = m
    const goneOffline = () => setOffline(true)
    window.addEventListener('offline', goneOffline)
    return () => {
      window.removeEventListener('offline', goneOffline)
      m.remove()
      map.current = null
      lines.current = null
      fitted.current = false
    }
  }, [offline, live])

  useEffect(() => {
    const m = map.current
    const g = lines.current
    if (!m || !g) return
    g.clearLayers()
    const color = css('--accent', '#ff6b1a')
    const segs = route.filter((s) => s.length).map((s) => s.map(([, lat, lon]) => L.latLng(lat, lon)))
    for (const s of segs) L.polyline(s, { color, weight: 5, opacity: 0.9 }).addTo(g)
    const first = segs[0]?.[0]
    const lastSeg = segs[segs.length - 1]
    const last = lastSeg?.[lastSeg.length - 1]
    if (first && !live) L.circleMarker(first, { radius: 6, color: '#fff', weight: 2, fillColor: css('--good', '#3dd68c'), fillOpacity: 1 }).addTo(g)
    if (last) L.circleMarker(last, { radius: live ? 8 : 6, color: '#fff', weight: 2, fillColor: live ? color : css('--bad', '#ff6464'), fillOpacity: 1 }).addTo(g)
    if (live) {
      if (last && followRef.current) m.setView(last, Math.max(m.getZoom(), 16), { animate: false })
    } else if (segs.length && !fitted.current) {
      m.fitBounds(L.latLngBounds(segs.flat()), { padding: [24, 24] })
      fitted.current = true
    }
  }, [route, live, offline])

  if (offline) return <RouteSvg route={route} className={className} />
  return (
    <div className="relative">
      <div ref={el} className={`z-0 w-full overflow-hidden rounded-xl bg-surface-2 ${className}`} role="img" aria-label="Route map" />
      {live && !follow && (
        <button
          type="button"
          onClick={() => {
            followRef.current = true
            setFollow(true)
            const lastSeg = route.filter((s) => s.length).at(-1)
            const p = lastSeg?.at(-1)
            if (p && map.current) map.current.setView([p[1], p[2]], Math.max(map.current.getZoom(), 16))
          }}
          className="absolute top-2 right-2 z-[500] min-h-11 rounded-xl bg-surface px-3 text-sm font-semibold shadow"
        >
          Follow
        </button>
      )}
    </div>
  )
}
