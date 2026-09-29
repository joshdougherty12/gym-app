import { useMemo, type CSSProperties } from 'react'
import { isSeason } from '../lib/accent'
import { fxPieces, MotifSvg, useSeasonMode } from '../lib/seasonArt'
import { useAccentStore } from '../store/accent'

/**
 * The drifting pieces of a seasonal theme (falling leaves, floating ghosts,
 * snow, fireworks, balloons…), behind the content and never in the way:
 * no pointer events, hidden from screen readers, and gone with reduced motion.
 */
export function SeasonFx() {
  const accent = useAccentStore((s) => s.accent)
  const mode = useSeasonMode()
  const pieces = useMemo(() => (isSeason(accent) ? fxPieces(accent, mode) : []), [accent, mode])
  if (!pieces.length) return null
  return (
    <div className="season-fx" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={`${accent}-${i}`}
          className={`season-fx-piece fx-${p.anim}`}
          style={
            {
              left: `${p.left}%`,
              top: p.anim === 'twinkle' || p.anim === 'burst' ? `${p.top}%` : undefined,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
>
          <MotifSvg m={p.m} colors={p.colors} />
        </span>
      ))}
    </div>
  )
}
