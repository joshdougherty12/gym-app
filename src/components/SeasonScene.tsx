import type { ReactNode } from 'react'
import { isSeason } from '../lib/accent'
import { Piece, SEASON_ART, useSeasonMode, type Colors } from '../lib/seasonArt'
import type { Season } from '../lib/seasons'
import { useAccentStore } from '../store/accent'

/**
 * A small illustrated scene across the top of Today, different for every
 * season: a leafy branch, a cobweb with a dangling spider, a turkey, twinkling
 * lights, the ball drop, icicles and a snowman, a rainbow and flowers, a
 * sunrise cross, a waving flag, a sun in sunglasses over the waves, balloons.
 * Drawn on a 360×76 grid; the animations stop with reduced motion.
 */

const W = 360
const H = 76

/** White things (snowman, bunny, clouds, lily) get a soft outline in light mode. */
const white = { fill: 'var(--scene-white)', stroke: 'var(--scene-outline)', strokeWidth: 1 }

function Fall({ c }: { c: Colors }) {
  const bark = '#6a4425'
  return (
    <>
      <path d="M368 4C326 8 296 2 258 12S200 28 150 16" fill="none" stroke={bark} strokeWidth="5" strokeLinecap="round" />
      <path d="M268 9l-9 15M220 21l4 13M180 22l-7 12M310 5l5 10" fill="none" stroke={bark} strokeWidth="2.5" strokeLinecap="round" />
      <Piece m="maple" colors={{ ...c, a: '#d8552a' }} x={246} y={20} s={1.05} className="sc-rustle" />
      <Piece m="leaf" colors={{ ...c, b: '#e8912c' }} x={214} y={30} s={0.95} r={10} className="sc-rustle sc-d1" />
      <Piece m="maple" colors={{ ...c, a: '#e3b23c' }} x={160} y={30} s={0.9} r={-8} className="sc-rustle sc-d2" />
      <Piece m="acorn" colors={c} x={306} y={13} s={0.7} className="sc-rustle sc-d1" />
      <Piece m="maple" colors={{ ...c, a: '#e8912c' }} x={322} y={-4} s={0.85} r={20} className="sc-rustle sc-d2" />
      <Piece m="leaf" colors={{ ...c, b: '#c2441c' }} x={186} y={6} s={0.75} r={-30} className="sc-rustle" />
      {/* One leaf keeps letting go of the branch. */}
      <Piece m="maple" colors={{ ...c, a: '#c2441c' }} x={196} y={24} s={0.8} className="sc-leaf-fall" />
      <Piece m="gourd" colors={{ ...c, pumpkin: '#e8762c', rib: '#b5541a' }} x={8} y={36} s={1.55} />
      <Piece m="gourd" colors={{ ...c, pumpkin: '#e3a23c', rib: '#b87a1f' }} x={48} y={50} s={1.05} r={6} />
      <Piece m="leaf" colors={{ ...c, b: '#b8452a' }} x={78} y={58} s={0.7} r={70} />
    </>
  )
}

function Halloween({ c }: { c: Colors }) {
  const angles = [0, 22.5, 45, 67.5, 90].map((a) => (a * Math.PI) / 180)
  const pt = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)] as const
  const rings = [16, 30, 45, 60]
  return (
    <>
      <g stroke="var(--ink-muted)" strokeOpacity="0.55" strokeWidth="1" fill="none">
        {angles.map((a, i) => {
          const [x, y] = pt(78, a)
          return <line key={i} x1="0" y1="0" x2={x} y2={y} />
        })}
        {rings.map((r) => (
          <path
            key={r}
            d={angles
              .slice(1)
              .map((a, i) => {
                const [x0, y0] = pt(r, angles[i]!)
                const [x1, y1] = pt(r, a)
                const [cx, cy] = pt(r * 0.8, (a + angles[i]!) / 2)
                return `${i === 0 ? `M${x0} ${y0}` : ''}Q${cx} ${cy} ${x1} ${y1}`
              })
              .join('')}
          />
        ))}
      </g>
      {/* A spider bobbing on its thread. */}
      <g className="sc-spider">
        <line x1="40" y1="24" x2="40" y2="46" stroke="var(--ink-muted)" strokeWidth="0.8" />
        <g fill="var(--ink)" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round">
          <path d="M34 44l-6-4M34 47l-7 0M34 50l-6 4M46 44l6-4M46 47l7 0M46 50l6 4" fill="none" />
          <ellipse cx="40" cy="48" rx="5" ry="6" />
          <circle cx="40" cy="41.5" r="3" />
        </g>
        <circle cx="38.8" cy="41" r="0.8" fill="#ff7a1a" />
        <circle cx="41.2" cy="41" r="0.8" fill="#ff7a1a" />
      </g>
      {/* Jack-o-lanterns with a flickering glow. */}
      {[
        [226, 34, 1.4],
        [266, 44, 1.0],
        [296, 30, 1.6],
      ].map(([x, y, s], i) => (
        <g key={i}>
          <circle cx={x! + 12 * s!} cy={y! + 14 * s!} r={15 * s!} fill="#ff9a3c" className={`sc-glow sc-d${i}`} />
          <Piece m="pumpkin" colors={{ ...c, face: '#ffd166' }} x={x!} y={y!} s={s!} />
        </g>
      ))}
      <Piece m="bat" colors={c} x={0} y={4} s={1.1} className="sc-bat" />
    </>
  )
}

function Thanksgiving({ c }: { c: Colors }) {
  const tail = ['#c8563a', '#e0a040', '#8a5a2c', '#d9772a', '#8a5a2c', '#e0a040', '#c8563a']
  return (
    <>
      {/* Wheat sheaf */}
      <g stroke="#c9a043" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M34 76C33 58 28 40 20 20M36 76C36 56 36 36 36 14M38 76C39 58 44 40 52 22" />
      </g>
      {[
        [20, 20, -22],
        [36, 14, 0],
        [52, 22, 22],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`} fill="#e0b04a">
          {[0, 5, 10, 15].map((dy) => (
            <g key={dy}>
              <ellipse cx={x! - 2.5} cy={y! + dy} rx="2" ry="3.4" transform={`rotate(-25 ${x! - 2.5} ${y! + dy})`} />
              <ellipse cx={x! + 2.5} cy={y! + dy} rx="2" ry="3.4" transform={`rotate(25 ${x! + 2.5} ${y! + dy})`} />
            </g>
          ))}
        </g>
      ))}
      <Piece m="pie" colors={{ ...c, b: '#e0a040', d: '#b87a3a' }} x={74} y={40} s={1.3} />
      <Piece m="maple" colors={{ ...c, a: '#c8563a' }} x={132} y={52} s={0.8} r={-20} />
      {/* The turkey: fanned tail, round body, bobbing head. */}
      <g>
        {tail.map((col, i) => {
          const a = -75 + i * 25
          return <ellipse key={i} cx="318" cy="30" rx="6.5" ry="19" fill={col} transform={`rotate(${a} 318 52)`} />
        })}
        <ellipse cx="318" cy="56" rx="15" ry="15" fill="#7a4f2c" />
        <path d="M309 70l-2 6M327 70l2 6" stroke="#e0a040" strokeWidth="2" strokeLinecap="round" />
        <g className="sc-peck">
          <circle cx="318" cy="38" r="8" fill="#8a5a2c" />
          <circle cx="315" cy="36" r="2" fill="#fff" />
          <circle cx="321" cy="36" r="2" fill="#fff" />
          <circle cx="315.4" cy="36.4" r="1" fill="#1a0f06" />
          <circle cx="321.4" cy="36.4" r="1" fill="#1a0f06" />
          <path d="M315 40h6l-3 4z" fill="#e0a040" />
          <path d="M318.5 43c2 1 2.4 4.6 .6 6.4-1.6-1.4-1.8-4.2-.6-6.4z" fill="#d6455d" />
        </g>
      </g>
    </>
  )
}

function Christmas({ c }: { c: Colors }) {
  const colors = ['#e5383b', '#f2c14e', '#2f9e5a', '#4a8fe0', '#ff7ac6']
  const bulbs: { x: number; y: number; r: number }[] = []
  for (let seg = 0; seg < 4; seg++)
    for (const t of [0.25, 0.5, 0.75]) {
      const x = seg * 90 + t * 90
      bulbs.push({ x, y: 6 + 28 * t * (1 - t) * 1, r: (t - 0.5) * -40 })
    }
  return (
    <>
      <path d="M0 6Q22.5 20 45 6T90 6T135 6T180 6T225 6T270 6T315 6T360 6" fill="none" stroke="#2f5a3a" strokeWidth="1.6" />
      {bulbs.map((b, i) => {
        const col = colors[i % colors.length]!
        return (
          <g key={i} transform={`rotate(${b.r} ${b.x} ${b.y})`}>
            <circle cx={b.x} cy={b.y + 12} r="9" fill={col} className={`sc-twinkle sc-d${i % 3}`} />
            <rect x={b.x - 2.5} y={b.y} width="5" height="4" rx="1" fill="#6b7a70" />
            <ellipse cx={b.x} cy={b.y + 10} rx="4.5" ry="6.5" fill={col} />
            <ellipse cx={b.x - 1.4} cy={b.y + 8} rx="1.2" ry="2" fill="#fff" opacity="0.55" />
          </g>
        )
      })}
      {/* Wreath with a bow */}
      <g transform="translate(318 48)">
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-15" rx="6" ry="4" fill={i % 2 ? '#2f9e5a' : '#1c7a41'} transform={`rotate(${i * 30})`} />
        ))}
        {[0, 90, 200, 290].map((a) => (
          <circle key={a} cx={15 * Math.cos((a * Math.PI) / 180)} cy={15 * Math.sin((a * Math.PI) / 180)} r="2.2" fill="#e5383b" />
        ))}
        <path d="M0 13l-8-5v10zM0 13l8-5v10z" fill="#e5383b" />
        <circle cx="0" cy="13" r="2.4" fill="#b3121f" />
      </g>
      <Piece m="gift" colors={{ ...c, a: '#e5383b' }} x={4} y={44} s={1.25} />
      <Piece m="gift" colors={{ ...c, a: '#2f9e5a' }} x={36} y={54} s={0.9} r={-6} />
    </>
  )
}

function Nye({ c }: { c: Colors }) {
  const year = new Date().getFullYear() + 1
  return (
    <>
      {/* The ball drop */}
      <line x1="300" y1="0" x2="300" y2="16" stroke="var(--ink-muted)" strokeWidth="2" />
      <g className="sc-ball">
        <circle cx="300" cy="34" r="16" fill="#e8c15a" />
        <g stroke="#a7811d" strokeWidth="0.8" fill="none">
          <path d="M284 34h32M286 26h28M286 42h28M300 18v32M292 20c-3 8-3 20 0 28M308 20c3 8 3 20 0 28" />
        </g>
        <circle cx="294" cy="28" r="3" fill="#fff" opacity="0.7" />
      </g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
        const r = (a * Math.PI) / 180
        return <line key={a} x1={300 + 20 * Math.cos(r)} y1={34 + 20 * Math.sin(r)} x2={300 + 27 * Math.cos(r)} y2={34 + 27 * Math.sin(r)} stroke="#f6e3a3" strokeWidth="1.4" strokeLinecap="round" className={`sc-twinkle sc-d${i % 3}`} />
      })}
      <Piece m="burst" colors={{ ...c, a: '#ff6bcb' }} x={30} y={6} s={2.2} className="sc-pop" />
      <Piece m="burst" colors={{ ...c, a: '#e8c15a' }} x={110} y={0} s={1.7} className="sc-pop sc-d1" />
      <Piece m="burst" colors={{ ...c, a: '#8fb0ff' }} x={186} y={14} s={2} className="sc-pop sc-d2" />
      <text x="226" y="70" fill="#e8c15a" fontFamily="'Barlow Condensed', sans-serif" fontWeight="700" fontSize="18" letterSpacing="2">
        {year}
      </text>
      <Piece m="champagne" colors={c} x={4} y={48} s={1.1} r={-12} />
      <Piece m="champagne" colors={c} x={22} y={48} s={1.1} r={12} />
    </>
  )
}

function Winter() {
  const lengths = [14, 24, 10, 32, 16, 22, 12, 28, 9, 20, 26, 11, 18, 30, 13, 22, 10, 25, 15, 19]
  return (
    <>
      <path d={`M0 0H${W}V4H0z`} fill="var(--scene-white)" />
      {lengths.map((len, i) => {
        const x = 4 + i * 15.2
        return <path key={i} d={`M${x} 3L${x + 4} ${3 + len}L${x + 8} 3z`} fill="#bfe0ff" opacity="0.9" />
      })}
      <circle cx="56" cy="36" r="2.2" fill="#bfe0ff" className="sc-drip" />
      {/* Snowman */}
      <ellipse cx="318" cy="74" rx="40" ry="5" {...white} />
      <circle cx="318" cy="58" r="14" {...white} />
      <circle cx="318" cy="38" r="10" {...white} />
      <circle cx="318" cy="22" r="8" {...white} />
      <rect x="310" y="6" width="16" height="10" rx="1.5" fill="#1d2733" />
      <rect x="306" y="14" width="24" height="3" rx="1.5" fill="#1d2733" />
      <circle cx="315" cy="21" r="1.2" fill="#1d2733" />
      <circle cx="321" cy="21" r="1.2" fill="#1d2733" />
      <path d="M318 23.5l7 1.5-7 1.5z" fill="#ff8a3c" />
      <path d="M308 30h20v4h-20zM322 33h4v10h-4z" fill="#e0405a" />
      <circle cx="318" cy="39" r="1.3" fill="#1d2733" />
      <circle cx="318" cy="44" r="1.3" fill="#1d2733" />
      <path d="M308 38l-14-8M294 30l-2-5M328 38l14-9M342 29l4-4" stroke="#7a4f2c" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  )
}

function Spring({ c }: { c: Colors }) {
  const bands = ['#ff8f9e', '#ffc37a', '#ffe98a', '#8fe3a0', '#8fc8ff', '#c7a0ff']
  const flowers = [
    [196, 40, '#ff8fb7'],
    [228, 30, '#ffd166'],
    [258, 44, '#c7a0ff'],
    [290, 32, '#ff8fb7'],
    [322, 42, '#8fd3ff'],
  ] as const
  return (
    <>
      {bands.map((col, i) => (
        <path key={i} d={`M${14 + i * 7} 76A${64 - i * 7} ${64 - i * 7} 0 0 1 ${142 - i * 7} 76`} fill="none" stroke={col} strokeWidth="7" opacity="0.9" />
      ))}
      <g {...white}>
        <circle cx="16" cy="68" r="9" />
        <circle cx="30" cy="64" r="11" />
        <circle cx="44" cy="70" r="8" />
      </g>
      <path d={`M170 76Q265 60 ${W} 76z`} fill="#5fae54" />
      {flowers.map(([x, y, col], i) => (
        <g key={i} className={`sc-rustle sc-d${i % 3}`}>
          <path d={`M${x + 12} ${y + 16}V76`} stroke="#4f8a3a" strokeWidth="2" />
          <path d={`M${x + 12} ${y + 30}c-6-1-8-5-8-8 5 0 8 3 8 8z`} fill="#4f8a3a" />
          <Piece m="flower" colors={{ ...c, a: col, center: '#ffe08a' }} x={x} y={y} s={1} />
        </g>
      ))}
      <Piece m="butterfly" colors={{ ...c, b: '#c7a0ff' }} x={150} y={10} s={1} className="sc-flutter" />
    </>
  )
}

function Easter({ c }: { c: Colors }) {
  return (
    <>
      {/* Sunrise behind the cross on the hill */}
      <g className="sc-rays">
        {Array.from({ length: 12 }, (_, i) => {
          const a = Math.PI + (i / 11) * Math.PI
          return <line key={i} x1={96 + 26 * Math.cos(a)} y1={56 + 26 * Math.sin(a)} x2={96 + 44 * Math.cos(a)} y2={56 + 44 * Math.sin(a)} stroke="#ffd98a" strokeWidth="2.4" strokeLinecap="round" />
        })}
      </g>
      <circle cx="96" cy="56" r="22" fill="#ffe08a" />
      <path d="M0 76Q96 30 200 76z" fill="#6fbf62" />
      <path d="M93 8h6v14h11v6H99v26h-6V28H82v-6h11z" fill="#8a5a2c" stroke="#e8c15a" strokeWidth="1" />
      {/* Grass with eggs, bunny ears peeking, an Easter lily */}
      <path d={`M190 76Q280 58 ${W} 70V76z`} fill="#8fd47a" />
      <g className="sc-peek">
        <ellipse cx="236" cy="58" rx="4" ry="11" {...white} />
        <ellipse cx="246" cy="58" rx="4" ry="11" {...white} />
        <ellipse cx="236" cy="59" rx="1.6" ry="7" fill="#ffb3cf" />
        <ellipse cx="246" cy="59" rx="1.6" ry="7" fill="#ffb3cf" />
      </g>
      <path d={`M190 76Q280 62 ${W} 72V76z`} fill="#8fd47a" />
      <Piece m="egg" colors={{ ...c, a: '#c9a7ff', b: '#fff1a8' }} x={268} y={52} s={0.9} r={-10} />
      <Piece m="egg" colors={{ ...c, a: '#8fe3bd', b: '#ffffff' }} x={290} y={56} s={0.8} r={12} />
      <Piece m="egg" colors={{ ...c, a: '#ffb3cf', b: '#8fd3ff' }} x={210} y={58} s={0.75} r={4} />
      <Piece m="lily" colors={c} x={318} y={20} s={1.8} r={-6} />
      <Piece m="dove" colors={c} x={150} y={6} s={1.2} className="sc-flutter" />
    </>
  )
}

function Patriotic({ c }: { c: Colors }) {
  const stripes = Array.from({ length: 7 }, (_, i) => i)
  return (
    <>
      <line x1="16" y1="2" x2="16" y2="76" stroke="#b9c2d6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="3" r="3" fill="#e8c15a" />
      <g className="sc-flag">
        <rect x="18" y="6" width="76" height="42" fill="#f5f7fb" />
        {stripes.map((i) => (
          <rect key={i} x="18" y={6 + i * 6} width="76" height="3" fill="#d42a3c" />
        ))}
        <rect x="18" y="6" width="32" height="21" fill="#1d3f8f" />
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} cx={22 + (i % 4) * 8} cy={10 + Math.floor(i / 4) * 6.5} r="1.3" fill="#fff" />
        ))}
      </g>
      <Piece m="burst" colors={{ ...c, a: '#ff4d5e' }} x={150} y={4} s={2} className="sc-pop" />
      <Piece m="burst" colors={{ ...c, a: '#f5f7fb' }} x={226} y={16} s={1.7} className="sc-pop sc-d1" />
      <Piece m="burst" colors={{ ...c, a: '#6e9bff' }} x={292} y={2} s={2.1} className="sc-pop sc-d2" />
      <Piece m="star" colors={{ ...c, gold: '#ff4d5e' }} x={118} y={50} s={0.8} className="sc-twinkle" />
      <Piece m="star" colors={{ ...c, gold: '#6e9bff' }} x={204} y={54} s={0.7} className="sc-twinkle sc-d1" />
      <Piece m="star" colors={{ ...c, gold: '#e8ecf5' }} x={276} y={52} s={0.8} className="sc-twinkle sc-d2" />
    </>
  )
}

function Summer() {
  return (
    <>
      {/* Sun in sunglasses */}
      <g className="sc-spin">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <line key={i} x1={320 + 22 * Math.cos(a)} y1={26 + 22 * Math.sin(a)} x2={320 + 31 * Math.cos(a)} y2={26 + 31 * Math.sin(a)} stroke="#ffc53d" strokeWidth="3" strokeLinecap="round" />
        })}
      </g>
      <circle cx="320" cy="26" r="18" fill="#ffc53d" />
      <rect x="306" y="19" width="12" height="8" rx="3" fill="#1d2733" />
      <rect x="322" y="19" width="12" height="8" rx="3" fill="#1d2733" />
      <path d="M318 22h4" stroke="#1d2733" strokeWidth="1.6" />
      <path d="M312 32q8 6 16 0" fill="none" stroke="#b36b00" strokeWidth="1.8" strokeLinecap="round" />
      {/* Sailboat on rolling waves */}
      <g className="sc-bob">
        <path d="M122 52h40l-6 8h-28z" fill="#e0634f" />
        <path d="M142 18v34M142 20l18 28h-18zM140 24l-14 24h14z" fill="#f5f7fb" stroke="#9aa9b0" strokeWidth="0.8" />
      </g>
      <g className="sc-waves">
        <path d={`M0 62${Array.from({ length: 16 }, () => `q${11} -8 ${22} 0 `).join('')}V76H0z`} fill="#33b8c4" opacity="0.8" />
        <path d={`M-11 68${Array.from({ length: 16 }, () => `q${11} -6 ${22} 0 `).join('')}V76H-11z`} fill="#1f95a6" />
      </g>
    </>
  )
}

function Birthday({ c }: { c: Colors }) {
  const balloons = [
    [236, 2, '#ff5cc6'],
    [262, 12, '#7aa8ff'],
    [288, 0, '#ffd24d'],
    [312, 14, '#5fe0b0'],
    [334, 4, '#c7a0ff'],
  ] as const
  return (
    <>
      <Piece m="cake" colors={{ ...c, a: '#ff5cc6', b: '#7aa8ff' }} x={6} y={20} s={2.2} />
      {/* Confetti popping */}
      {Array.from({ length: 16 }, (_, i) => {
        const x = 70 + ((i * 37) % 130)
        const y = 6 + ((i * 23) % 60)
        const col = ['#ff5cc6', '#7aa8ff', '#ffd24d', '#5fe0b0'][i % 4]
        return <rect key={i} x={x} y={y} width="3" height="7" rx="1" fill={col} transform={`rotate(${(i * 47) % 180} ${x} ${y})`} className={`sc-twinkle sc-d${i % 3}`} />
      })}
      {balloons.map(([x, y, col], i) => (
        <g key={i} className={`sc-bob sc-d${i % 3}`}>
          <path d={`M${x + 12} ${y + 17}Q${x + 12 + (290 - x) * 0.3} ${y + 40} 296 76`} fill="none" stroke="var(--ink-muted)" strokeWidth="0.8" />
          <Piece m="balloon" colors={{ ...c, a: col }} x={x} y={y} s={1.15} />
        </g>
      ))}
    </>
  )
}

const SCENES: Record<Season, (p: { c: Colors }) => ReactNode> = {
  fall: Fall,
  halloween: Halloween,
  thanksgiving: Thanksgiving,
  christmas: Christmas,
  nye: Nye,
  winter: Winter,
  spring: Spring,
  easter: Easter,
  patriotic: Patriotic,
  summer: Summer,
  birthday: Birthday,
}

export function SeasonScene() {
  const accent = useAccentStore((s) => s.accent)
  const mode = useSeasonMode()
  if (!isSeason(accent)) return null
  const Scene = SCENES[accent]
  return (
    <div className="season-scene -mx-4 mb-1" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
        <Scene c={SEASON_ART[accent].colors[mode]} />
      </svg>
    </div>
  )
}
