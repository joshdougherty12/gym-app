import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** A QR code as crisp SVG. Always dark on white (scanners need it, whatever the theme). */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text, 'Byte')
    q.make()
    const n = q.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4},${r + 4}h1v1h-1z`
    return { size: n + 8, path: d }
  }, [text])
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} className="mx-auto aspect-square w-full max-w-72 rounded-xl" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
