import type { Activity, ActivityType } from '../../types'
import { ACTIVITY } from './track'

const GPX_TYPE: Record<ActivityType, string> = { run: 'running', walk: 'walking', hike: 'hiking', bike: 'cycling' }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** GPX 1.1 of a saved activity: one track, one trkseg per segment, points in time order. */
export function toGpx(a: Activity, appName: string): string {
  const name = `${ACTIVITY[a.type].label} ${a.date}`
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${esc(appName)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `  <metadata><name>${esc(name)}</name><time>${new Date(a.startedAt).toISOString()}</time></metadata>`,
    '  <trk>',
    `    <name>${esc(name)}</name>`,
    `    <type>${GPX_TYPE[a.type]}</type>`,
  ]
  for (const seg of a.route) {
    if (!seg.length) continue
    lines.push('    <trkseg>')
    for (const [sec, lat, lon, ele] of [...seg].sort((x, y) => x[0] - y[0])) {
      const e = ele === null ? '' : `<ele>${ele.toFixed(1)}</ele>`
      lines.push(`      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${e}<time>${new Date(a.startedAt + Math.round(sec * 1000)).toISOString()}</time></trkpt>`)
    }
    lines.push('    </trkseg>')
  }
  lines.push('  </trk>', '</gpx>', '')
  return lines.join('\n')
}

export function gpxFileName(a: Activity): string {
  return `rightpace-${ACTIVITY[a.type].noun}-${a.date}.gpx`
}
