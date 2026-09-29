import { isSeason } from '../lib/accent'
import { MotifSvg, SEASON_ART, useSeasonMode, type Motif } from '../lib/seasonArt'
import { useAccentStore } from '../store/accent'

const COUNT = 8
const NOT_HANGING = new Set<Motif>(['bat', 'dot', 'burst', 'wave', 'confetti'])

/** A garland across the top of Today in a seasonal theme: the season's pieces on a swaying string. */
export function SeasonGarland() {
  const accent = useAccentStore((s) => s.accent)
  const mode = useSeasonMode()
  if (!isSeason(accent)) return null
  const art = SEASON_ART[accent]
  // Pieces that hang well on a string (no bats, dots, fireworks, waves or confetti).
  const hangable = art.tile.filter((t) => !NOT_HANGING.has(t.m))
  const items = Array.from({ length: COUNT }, (_, i) => hangable[i % hangable.length]!)
  return (
    <div className="season-garland -mx-4 mb-2 h-11" aria-hidden="true">
      <svg viewBox="0 0 360 44" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-6 w-full">
        <path d="M0 4 Q22.5 18 45 4 T90 4 T135 4 T180 4 T225 4 T270 4 T315 4 T360 4" fill="none" stroke="var(--ink-muted)" strokeOpacity="0.5" strokeWidth="1.2" />
      </svg>
      {items.map((t, i) => (
        <span
          key={i}
          className="season-garland-piece"
          style={{ left: `${((i + 0.5) / COUNT) * 100}%`, animationDelay: `${-i * 0.7}s`, rotate: `${i % 2 ? 8 : -8}deg` }}
        >
          <MotifSvg m={t.m} colors={{ ...art.colors[mode], ...(t.c ?? {}) }} />
        </span>
      ))}
    </div>
  )
}
