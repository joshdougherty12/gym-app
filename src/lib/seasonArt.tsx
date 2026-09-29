import { useEffect, useState } from 'react'
import type { Season } from './seasons'

/**
 * Artwork for the seasonal themes, all drawn on a 24×24 grid: the scattered
 * background pattern, the drifting foreground pieces (SeasonFx.tsx) and the
 * checkmark glyph. Colors are named per part and filled in per season and mode.
 */

export interface Part {
  d: string
  /** Color role, looked up in the season's palette. */
  c: string
  /** Drawn as a line instead of a fill. */
  stroke?: number
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`
const petals = [0, 72, 144, 216, 288]
  .map((a) => circle(+(12 + 5.4 * Math.sin((a * Math.PI) / 180)).toFixed(2), +(12 - 5.4 * Math.cos((a * Math.PI) / 180)).toFixed(2), 3.6))
  .join('')

export const MOTIFS = {
  maple: [{ d: 'M12 1l1.6 4.5L17 4l-1 4.5 5-.5-2.5 3.5 3.5 2-5 1 1 3.5-5-1.5-.2 5.5h-1.6l-.2-5.5-5 1.5 1-3.5-5-1 3.5-2L3 8l5 .5L7 4l3.4 1.5z', c: 'a' }],
  leaf: [
    { d: 'M12 2c4 3 7 7 6.5 11.5C18 18 15 21 12 22c-3-1-6-4-6.5-8.5C5 9 8 5 12 2z', c: 'b' },
    { d: 'M12 6v15', c: 'vein', stroke: 1 },
  ],
  acorn: [
    { d: 'M6.5 10h11c0 6-3 11-5.5 12C9.5 21 6.5 16 6.5 10z', c: 'c' },
    { d: 'M5 10.5a7 4.5 0 0 1 14 0zM11.2 6.1c0-1.3.4-2.4 1.3-3.1l.8.7c-.6.5-.8 1.3-.8 2.4z', c: 'd' },
  ],
  ghost: [
    { d: 'M12 2C7.6 2 5 5.4 5 9.5V21l2.3-1.6L9.6 21l2.4-1.6 2.4 1.6 2.3-1.6L19 21V9.5C19 5.4 16.4 2 12 2z', c: 'ghost' },
    { d: `${ellipse(9.4, 9.4, 1.2, 1.6)}${ellipse(14.6, 9.4, 1.2, 1.6)}${ellipse(12, 13.8, 1, 1.3)}`, c: 'face' },
  ],
  pumpkin: [
    { d: 'M12 6.5c-1.7 0-2.8.4-3.8.9C5.2 7 3 9.6 3 13.6 3 17.8 5.6 21 8.6 21c1.2 0 2.2-.4 3.4-.4s2.2.4 3.4.4c3 0 5.6-3.2 5.6-7.4 0-4-2.2-6.6-5.2-6.2-1-.5-2.1-.9-3.8-.9z', c: 'pumpkin' },
    { d: 'M11.2 7c0-2.2.6-3.8 2.2-4.8l1.1 1.1c-1.1.8-1.5 2-1.5 3.7z', c: 'stem' },
    { d: 'M7.2 11.3l2.3 2.6H5.8zM16.8 11.3l1.4 2.6h-3.7zM6.8 15.8c1.6 1.9 3.4 2.6 5.2 2.6s3.6-.7 5.2-2.6l-1.9.5-.9 1-1.2-.9-1.2.9-1.2-.9-1.2.9-.9-1z', c: 'face' },
  ],
  gourd: [
    { d: 'M12 6.5c-1.7 0-2.8.4-3.8.9C5.2 7 3 9.6 3 13.6 3 17.8 5.6 21 8.6 21c1.2 0 2.2-.4 3.4-.4s2.2.4 3.4.4c3 0 5.6-3.2 5.6-7.4 0-4-2.2-6.6-5.2-6.2-1-.5-2.1-.9-3.8-.9z', c: 'pumpkin' },
    { d: 'M9 8.5c-1.4 2.6-1.4 8.8 0 11.8M15 8.5c1.4 2.6 1.4 8.8 0 11.8', c: 'rib', stroke: 0.9 },
    { d: 'M11.2 7c0-2.2.6-3.8 2.2-4.8l1.1 1.1c-1.1.8-1.5 2-1.5 3.7z', c: 'stem' },
  ],
  bat: [{ d: 'M12 9.2c-.8 0-1.3-.9-1.3-.9l-.6 1.6C8.4 8.6 5.4 8 2 9.6c2.1.5 3.2 2 3.2 3.6 1-1 2.6-1.1 3.6-.1.6-1 2-1.6 3.2-.7 1.2-.9 2.6-.3 3.2.7 1-1 2.6-.9 3.6.1 0-1.6 1.1-3.1 3.2-3.6-3.4-1.6-6.4-1-8.1.3l-.6-1.6s-.5.9-1.3.9z', c: 'bat' }],
  pie: [
    { d: 'M4 17.5L12.5 5 21 17.5z', c: 'b' },
    { d: 'M3 17h19v3H3z', c: 'd' },
  ],
  snowflake: [
    {
      d: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.8 10.2l3.4-.9-.9-3.4M20.2 13.8l-3.4.9.9 3.4M3.8 13.8l3.4.9-.9 3.4M20.2 10.2l-3.4-.9.9-3.4',
      c: 'snow',
      stroke: 1.6,
    },
  ],
  ornament: [
    { d: circle(12, 14.5, 7), c: 'a' },
    { d: 'M5.4 12.6h13.2v2.2H5.4zM10 5h4v3h-4z', c: 'gold' },
  ],
  tree: [
    { d: 'M12 2l5 6.5h-2.6l4.6 6h-3.2L20 19H4l4.2-4.5H5l4.6-6H7z', c: 'green' },
    { d: 'M10.8 19h2.4v3h-2.4z', c: 'd' },
  ],
  star: [{ d: 'M12 2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 16.8 6.1 20l1.3-6.5L2.5 8.9l6.6-.8z', c: 'gold' }],
  gift: [
    { d: 'M4 10h16v11H4zM3 7h18v3H3z', c: 'a' },
    { d: 'M11 7h2v14h-2zM12 7c-1-3-5-3.5-5-1.5S10 7 12 7zm0 0c1-3 5-3.5 5-1.5S14 7 12 7z', c: 'gold' },
  ],
  champagne: [
    { d: 'M8 2h8l-.6 6.5a3.4 3.4 0 0 1-6.8 0z', c: 'gold' },
    { d: 'M11.4 11.5h1.2V19h-1.2zM8.5 19.5h7V21h-7z', c: 'silver' },
  ],
  burst: [{ d: 'M12 2v5M12 17v5M2 12h5M17 12h5M4.9 4.9l3.5 3.5M15.6 15.6l3.5 3.5M4.9 19.1l3.5-3.5M15.6 8.4l3.5-3.5', c: 'a', stroke: 1.6 }],
  flower: [
    { d: petals, c: 'a' },
    { d: circle(12, 12, 2.4), c: 'center' },
  ],
  butterfly: [
    { d: 'M11.4 11C9.8 6.8 3 5 3 9.3c0 2.7 2.6 4 5.6 3.9C5.8 14.2 4.4 16 5.8 18.4c1.6 2 4.4.1 5.6-3.5zM12.6 11C14.2 6.8 21 5 21 9.3c0 2.7-2.6 4-5.6 3.9 2.8 1 4.2 2.8 2.8 5.2-1.6 2-4.4.1-5.6-3.5z', c: 'b' },
    { d: 'M11.3 8h1.4v10h-1.4z', c: 'd' },
  ],
  egg: [
    { d: 'M12 2.5c3.6 0 7 5.8 7 10.8a7 7 0 0 1-14 0c0-5 3.4-10.8 7-10.8z', c: 'a' },
    { d: 'M5.4 12.5l2.2-1.6 2.2 1.6 2.2-1.6 2.2 1.6 2.2-1.6 2.2 1.6v1.8l-2.2-1.6-2.2 1.6-2.2-1.6-2.2 1.6-2.2-1.6-2.2 1.6z', c: 'b' },
  ],
  bunny: [{ d: 'M8.2 2c-1.6 0-2.1 3.3-1 7.4A6 6 0 1 0 16.8 9.4c1.1-4.1.6-7.4-1-7.4S13.3 5 13.3 8.3h-2.6C10.7 5 9.8 2 8.2 2z', c: 'bunny' }],
  cross: [{ d: 'M10.6 2h2.8v6.2H19v2.8h-5.6V22h-2.8V11H5V8.2h5.6z', c: 'gold' }],
  lily: [
    { d: 'M11.4 13.5h1.2V22h-1.2zM12 19c-2.5-.3-4.4-1.7-5-4 2.4.1 4.2 1.4 5 4z', c: 'stem' },
    { d: 'M12 2.5c-1.2 3.4-4 5.8-7.5 6 1.6 1.8 3.8 2.9 6.2 3L11 14h2l.3-2.5c2.4-.1 4.6-1.2 6.2-3-3.5-.2-6.3-2.6-7.5-6z', c: 'white' },
    { d: 'M11.6 9.5h.8v3h-.8z', c: 'gold' },
  ],
  dove: [
    { d: 'M2.5 13.5c3.2.3 5.6-1.6 7.4-4.7 1.1-1.8 3.2-2.5 5-1.8L17 5l.4 2.4c1.7.8 2.8 2.4 3 4.2-2.1-.1-3.4.9-4.3 2.5-1.8 3.3-5.6 5.2-9.6 4.3l2.3-2c-3 .1-5.2-1.1-6.3-2.9z', c: 'white' },
    { d: circle(16.2, 8.8, 0.6), c: 'face' },
  ],
  palm: [
    { d: 'M4 21C9 16 13.5 10 19.5 3.5M8 16.8 4.6 15.9M8 16.8l.3 3.4M10.6 13.8 6.8 12.4M10.6 13.8l.9 3.7M13.2 10.7 9.6 8.6M13.2 10.7l1.4 3.4M15.8 7.7 12.6 5.3M15.8 7.7l1.8 3M18 5.1 15.4 2.9M18 5.1l2.2 2.3', c: 'green', stroke: 1.5 },
  ],
  sun: [
    { d: circle(12, 12, 5), c: 'gold' },
    { d: 'M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1', c: 'gold', stroke: 1.6 },
  ],
  wave: [{ d: 'M2 10c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1', c: 'b', stroke: 1.6 }],
  popsicle: [
    { d: 'M8 7a4 4 0 0 1 8 0v8.5H8z', c: 'a' },
    { d: 'M11 15.5h2V21h-2z', c: 'd' },
  ],
  flag: [
    { d: 'M3 5h18v11H3z', c: 'white' },
    { d: 'M3 5h18v1.6H3zM3 8.2h18v1.6H3zM3 11.4h18v1.6H3zM3 14.6h18v1.4H3z', c: 'a' },
    { d: 'M3 5h8v6H3z', c: 'b' },
  ],
  balloon: [
    { d: 'M12 2a6 7 0 0 1 6 7c0 4.2-3 7.5-6 7.5S6 13.2 6 9a6 7 0 0 1 6-7zM11 16.3h2l-1 1.4z', c: 'a' },
    { d: 'M12 17.7c-1 1.5 1 2.5 0 4.3', c: 'string', stroke: 0.8 },
  ],
  cake: [
    { d: 'M4 13h16v8H4z', c: 'b' },
    { d: 'M4 12.5h16v1c-1.3 1.6-2.7 1.6-4 0-1.3 1.6-2.7 1.6-4 0-1.3 1.6-2.7 1.6-4 0-1.3 1.6-2.7 1.6-4 0z', c: 'white' },
    { d: 'M8 7h1.4v5H8zM11.3 7h1.4v5h-1.4zM14.6 7h1.4v5h-1.4z', c: 'a' },
    { d: 'M8.7 4c.8 1 .8 2 0 2.6-.8-.6-.8-1.6 0-2.6zM12 4c.8 1 .8 2 0 2.6-.8-.6-.8-1.6 0-2.6zM15.3 4c.8 1 .8 2 0 2.6-.8-.6-.8-1.6 0-2.6z', c: 'gold' },
  ],
  confetti: [{ d: 'M9 4h4v14H9z', c: 'a' }],
  dot: [{ d: circle(12, 12, 6), c: 'snow' }],
  bubble: [{ d: circle(12, 12, 8), c: 'b', stroke: 1.4 }],
  heart: [{ d: 'M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4.5 5.8 4.1c2.1-.2 3.9.9 5 2.6 1.1-1.7 2.9-2.8 5-2.6 3.7.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z', c: 'a' }],
} satisfies Record<string, Part[]>

export type Motif = keyof typeof MOTIFS
export type { Colors }

/** Colors for a motif's parts, in dark and light mode. `a`, `b`… are the season's own. */
type Colors = Record<string, string>


/** One placed motif: in the 200×200 background tile, or a drifting piece. */
interface Placed {
  m: Motif
  x: number
  y: number
  r?: number
  s?: number
  /** Override color roles for this one piece. */
  c?: Colors
}

interface SeasonArt {
  colors: { dark: Colors; light: Colors }
  tile: Placed[]
  /** Background pattern opacity, dark and light. */
  alpha: [number, number]
  /** Drifting pieces: which motifs, how they move, how many. */
  fx: { motifs: { m: Motif; c?: Colors }[]; anim: FxAnim; count: number; size: [number, number] }[]
  /** The checkmark in this theme. */
  glyph: Motif
}

export type FxAnim = 'fall' | 'snow' | 'drift' | 'twinkle' | 'burst' | 'rise' | 'flutter'

const WHITE_DARK = { ghost: '#f4f1fb', face: '#1a1424', snow: '#e8f3ff', white: '#f5f7fb', silver: '#cfd6e6', string: '#cfc6dd', vein: '#00000033', stem: '#4e7a2a', bunny: '#f6f1f8' }
// Light mode outlines white pieces (ghosts, lilies, doves, bunnies) so they don't vanish on a light background.
const WHITE_LIGHT = { ghost: '#ffffff', face: '#2a2238', snow: '#8fbde3', white: '#ffffff', silver: '#9aa3b5', string: '#8f86a0', vein: '#00000026', stem: '#4e7a2a', bunny: '#ffffff', outline: '#8f84a3' }
const OUTLINED = new Set(['white', 'ghost', 'bunny'])

export const SEASON_ART: Record<Season, SeasonArt> = {
  fall: {
    colors: {
      dark: { ...WHITE_DARK, a: '#d8552a', b: '#e8912c', c: '#b07a3a', d: '#6f4a2a' },
      light: { ...WHITE_LIGHT, a: '#c2441c', b: '#d9811c', c: '#a06a2c', d: '#6a4425' },
    },
    alpha: [0.16, 0.2],
    tile: [
      { m: 'maple', x: 12, y: 14, r: -18, s: 1.3 },
      { m: 'leaf', x: 110, y: 8, r: 28, s: 1.1 },
      { m: 'maple', x: 150, y: 90, r: 22, s: 1, c: { a: '#e3b23c' } },
      { m: 'acorn', x: 60, y: 76, r: -10, s: 0.9 },
      { m: 'leaf', x: 20, y: 136, r: -40, s: 1, c: { b: '#b8452a' } },
      { m: 'maple', x: 100, y: 150, r: 8, s: 0.8, c: { a: '#e8912c' } },
    ],
    fx: [
      {
        motifs: [{ m: 'maple' }, { m: 'leaf' }, { m: 'maple', c: { a: '#e3b23c' } }, { m: 'leaf', c: { b: '#c2441c' } }, { m: 'maple', c: { a: '#e8912c' } }],
        anim: 'fall',
        count: 12,
        size: [16, 30],
      },
    ],
    glyph: 'maple',
  },
  halloween: {
    colors: {
      dark: { ...WHITE_DARK, pumpkin: '#ff7a1a', face: '#1a0f05', stem: '#5f8f2a', bat: '#6b4fa3' },
      light: { ...WHITE_LIGHT, ghost: '#ffffff', pumpkin: '#e0660c', face: '#2a1606', stem: '#4e7a2a', bat: '#5b3f94' },
    },
    alpha: [0.2, 0.28],
    tile: [
      { m: 'ghost', x: 14, y: 12, r: -8, s: 1.3 },
      { m: 'pumpkin', x: 110, y: 18, r: 6, s: 1.2 },
      { m: 'bat', x: 60, y: 78, r: -12, s: 1 },
      { m: 'ghost', x: 150, y: 96, r: 10, s: 1 },
      { m: 'pumpkin', x: 24, y: 140, r: -6, s: 0.95 },
      { m: 'ghost', x: 96, y: 146, r: -4, s: 0.8 },
      { m: 'bat', x: 160, y: 168, r: 14, s: 0.7 },
    ],
    fx: [
      { motifs: [{ m: 'ghost' }], anim: 'drift', count: 8, size: [30, 56] },
      { motifs: [{ m: 'bat' }], anim: 'flutter', count: 3, size: [22, 30] },
    ],
    glyph: 'pumpkin',
  },
  thanksgiving: {
    colors: {
      dark: { ...WHITE_DARK, a: '#c8563a', b: '#e0a040', c: '#b47a3a', d: '#7a4f2c' },
      light: { ...WHITE_LIGHT, a: '#a8283d', b: '#c98a1c', c: '#9a652a', d: '#6a4425' },
    },
    alpha: [0.16, 0.2],
    tile: [
      { m: 'maple', x: 14, y: 16, r: -14, s: 1.2 },
      { m: 'pie', x: 108, y: 20, r: 0, s: 1.1 },
      { m: 'acorn', x: 150, y: 96, r: 16, s: 1 },
      { m: 'leaf', x: 62, y: 84, r: -30, s: 1 },
      { m: 'maple', x: 24, y: 142, r: 18, s: 0.9, c: { a: '#e0a040' } },
      { m: 'acorn', x: 104, y: 150, r: -12, s: 0.8 },
    ],
    fx: [{ motifs: [{ m: 'maple' }, { m: 'leaf' }, { m: 'maple', c: { a: '#e0a040' } }, { m: 'leaf', c: { b: '#8a5a2c' } }], anim: 'fall', count: 9, size: [16, 26] }],
    glyph: 'acorn',
  },
  christmas: {
    colors: {
      dark: { ...WHITE_DARK, a: '#e5383b', green: '#2f9e5a', gold: '#f2c14e', d: '#7a4f2c' },
      light: { ...WHITE_LIGHT, a: '#c21d2b', green: '#1c7a41', gold: '#c99a1c', d: '#6a4425' },
    },
    alpha: [0.2, 0.22],
    tile: [
      { m: 'tree', x: 12, y: 12, r: 0, s: 1.3 },
      { m: 'ornament', x: 112, y: 16, r: 10, s: 1.1 },
      { m: 'star', x: 70, y: 80, r: -8, s: 0.9 },
      { m: 'gift', x: 150, y: 92, r: 6, s: 1 },
      { m: 'snowflake', x: 26, y: 140, r: 0, s: 0.9 },
      { m: 'ornament', x: 104, y: 150, r: -10, s: 0.9, c: { a: '#2f9e5a' } },
    ],
    fx: [
      { motifs: [{ m: 'dot' }], anim: 'snow', count: 26, size: [3, 7] },
      { motifs: [{ m: 'snowflake' }], anim: 'snow', count: 5, size: [12, 18] },
    ],
    glyph: 'tree',
  },
  nye: {
    colors: {
      dark: { ...WHITE_DARK, a: '#e8c15a', gold: '#e8c15a', b: '#ff6bcb' },
      light: { ...WHITE_LIGHT, a: '#b08a1c', gold: '#b08a1c', b: '#b0208f' },
    },
    alpha: [0.2, 0.22],
    tile: [
      { m: 'champagne', x: 16, y: 14, r: -10, s: 1.2 },
      { m: 'burst', x: 110, y: 12, r: 0, s: 1.2 },
      { m: 'star', x: 70, y: 84, r: 12, s: 0.8 },
      { m: 'burst', x: 150, y: 100, r: 20, s: 1, c: { a: '#ff6bcb' } },
      { m: 'star', x: 28, y: 146, r: -6, s: 0.6, c: { gold: '#cfd6e6' } },
      { m: 'champagne', x: 104, y: 146, r: 12, s: 0.9 },
    ],
    fx: [
      { motifs: [{ m: 'star' }, { m: 'star', c: { gold: '#cfd6e6' } }], anim: 'twinkle', count: 14, size: [8, 16] },
      { motifs: [{ m: 'burst' }, { m: 'burst', c: { a: '#ff6bcb' } }, { m: 'burst', c: { a: '#8fb0ff' } }], anim: 'burst', count: 5, size: [48, 84] },
    ],
    glyph: 'star',
  },
  winter: {
    colors: {
      dark: { ...WHITE_DARK, gold: '#bfe0ff' },
      light: { ...WHITE_LIGHT, gold: '#7fb0dc' },
    },
    alpha: [0.18, 0.3],
    tile: [
      { m: 'snowflake', x: 14, y: 14, r: 0, s: 1.3 },
      { m: 'snowflake', x: 116, y: 24, r: 15, s: 0.9 },
      { m: 'star', x: 72, y: 84, r: 0, s: 0.5 },
      { m: 'snowflake', x: 150, y: 110, r: 30, s: 1.1 },
      { m: 'snowflake', x: 30, y: 144, r: 10, s: 0.7 },
      { m: 'dot', x: 100, y: 160, s: 0.4 },
    ],
    fx: [
      { motifs: [{ m: 'dot' }], anim: 'snow', count: 34, size: [3, 8] },
      { motifs: [{ m: 'snowflake' }], anim: 'snow', count: 6, size: [12, 20] },
    ],
    glyph: 'snowflake',
  },
  spring: {
    colors: {
      dark: { ...WHITE_DARK, a: '#ff8fb7', b: '#c7a0ff', center: '#ffd166', d: '#3f5f36' },
      light: { ...WHITE_LIGHT, a: '#e0568a', b: '#8f63d9', center: '#d9a41c', d: '#3f5f36' },
    },
    alpha: [0.17, 0.2],
    tile: [
      { m: 'flower', x: 14, y: 14, r: 0, s: 1.2 },
      { m: 'butterfly', x: 110, y: 18, r: 12, s: 1.1 },
      { m: 'flower', x: 66, y: 84, r: 20, s: 0.8, c: { a: '#ffd166', center: '#e0568a' } },
      { m: 'leaf', x: 150, y: 96, r: 30, s: 0.9, c: { b: '#5fae54' } },
      { m: 'flower', x: 26, y: 144, r: -12, s: 0.9, c: { a: '#c7a0ff' } },
      { m: 'butterfly', x: 110, y: 150, r: -14, s: 0.8, c: { b: '#ff8fb7' } },
    ],
    fx: [
      { motifs: [{ m: 'heart', c: { a: '#ffc2d6' } }, { m: 'flower', c: { a: '#ffd1e0', center: '#ffe08a' } }], anim: 'fall', count: 10, size: [10, 18] },
      { motifs: [{ m: 'butterfly' }, { m: 'butterfly', c: { b: '#ff8fb7' } }], anim: 'flutter', count: 2, size: [22, 28] },
    ],
    glyph: 'flower',
  },
  easter: {
    colors: {
      dark: { ...WHITE_DARK, a: '#c9a7ff', b: '#fff1a8', center: '#ffe08a', d: '#3f5f36', gold: '#e8c15a', green: '#6fae54', face: '#3a3040' },
      light: { ...WHITE_LIGHT, a: '#a987e6', b: '#fff6c2', center: '#e0b43c', d: '#3f5f36', gold: '#b08a1c', green: '#4f8a3a', white: '#fbf7ff', face: '#6a6078' },
    },
    alpha: [0.22, 0.32],
    // Eggs and bunnies, with the cross, Easter lilies, a dove and a palm frond (Palm Sunday).
    tile: [
      { m: 'cross', x: 14, y: 10, r: 0, s: 1.25 },
      { m: 'egg', x: 108, y: 12, r: -12, s: 1.1 },
      { m: 'lily', x: 62, y: 70, r: -8, s: 1.2 },
      { m: 'bunny', x: 152, y: 88, r: 0, s: 1 },
      { m: 'dove', x: 14, y: 132, r: -6, s: 1.1 },
      { m: 'egg', x: 104, y: 148, r: 10, s: 0.9, c: { a: '#8fe3bd', b: '#ffffff' } },
      { m: 'palm', x: 164, y: 158, r: 0, s: 0.9 },
    ],
    fx: [
      { motifs: [{ m: 'dove' }], anim: 'flutter', count: 3, size: [26, 34] },
      { motifs: [{ m: 'flower', c: { a: '#ffd1e0', center: '#ffe08a' } }, { m: 'flower', c: { a: '#e3d4ff', center: '#ffe08a' } }], anim: 'fall', count: 8, size: [10, 18] },
      { motifs: [{ m: 'butterfly', c: { b: '#c9a7ff' } }, { m: 'butterfly', c: { b: '#8fe3bd' } }], anim: 'flutter', count: 2, size: [22, 28] },
    ],
    glyph: 'egg',
  },
  patriotic: {
    colors: {
      dark: { ...WHITE_DARK, a: '#ff4d5e', b: '#4f7fe0', gold: '#f5f7fb' },
      light: { ...WHITE_LIGHT, a: '#b31b2c', b: '#1d3f8f', gold: '#1d3f8f' },
    },
    alpha: [0.2, 0.22],
    tile: [
      { m: 'flag', x: 12, y: 18, r: -8, s: 1.4 },
      { m: 'star', x: 116, y: 14, r: 10, s: 1 },
      { m: 'burst', x: 66, y: 84, r: 0, s: 1 },
      { m: 'star', x: 152, y: 96, r: -10, s: 0.9, c: { gold: '#ff4d5e' } },
      { m: 'burst', x: 24, y: 144, r: 20, s: 0.9, c: { a: '#4f7fe0' } },
      { m: 'star', x: 106, y: 152, r: 4, s: 0.8, c: { gold: '#4f7fe0' } },
    ],
    fx: [
      { motifs: [{ m: 'star' }, { m: 'star', c: { gold: '#ff4d5e' } }, { m: 'star', c: { gold: '#6e9bff' } }], anim: 'twinkle', count: 14, size: [8, 16] },
      { motifs: [{ m: 'burst' }, { m: 'burst', c: { a: '#6e9bff' } }, { m: 'burst', c: { a: '#f5f7fb' } }], anim: 'burst', count: 5, size: [48, 84] },
    ],
    glyph: 'star',
  },
  summer: {
    colors: {
      dark: { ...WHITE_DARK, a: '#ff7f6a', b: '#33d1c4', gold: '#ffc53d', d: '#c49a6a' },
      light: { ...WHITE_LIGHT, a: '#e0634f', b: '#0f8fa8', gold: '#e0a21c', d: '#a8805a' },
    },
    alpha: [0.18, 0.22],
    tile: [
      { m: 'sun', x: 14, y: 14, r: 0, s: 1.3 },
      { m: 'wave', x: 110, y: 20, r: 0, s: 1.2 },
      { m: 'popsicle', x: 66, y: 82, r: -14, s: 1 },
      { m: 'wave', x: 146, y: 104, r: 0, s: 1 },
      { m: 'sun', x: 26, y: 146, r: 20, s: 0.8 },
      { m: 'popsicle', x: 112, y: 150, r: 12, s: 0.8, c: { a: '#33d1c4' } },
    ],
    fx: [{ motifs: [{ m: 'bubble' }, { m: 'bubble', c: { b: '#ffc53d' } }], anim: 'rise', count: 9, size: [10, 24] }],
    glyph: 'sun',
  },
  birthday: {
    colors: {
      dark: { ...WHITE_DARK, a: '#ff5cc6', b: '#7aa8ff', gold: '#ffd24d' },
      light: { ...WHITE_LIGHT, a: '#e0359f', b: '#4f7fe0', gold: '#d9a41c' },
    },
    alpha: [0.2, 0.24],
    tile: [
      { m: 'balloon', x: 14, y: 10, r: -8, s: 1.3 },
      { m: 'cake', x: 110, y: 18, r: 0, s: 1.2 },
      { m: 'balloon', x: 66, y: 80, r: 10, s: 1, c: { a: '#7aa8ff' } },
      { m: 'heart', x: 150, y: 100, r: 12, s: 0.8, c: { a: '#ffd24d' } },
      { m: 'balloon', x: 26, y: 144, r: 4, s: 0.9, c: { a: '#ffd24d' } },
      { m: 'confetti', x: 110, y: 150, r: 30, s: 0.6 },
      { m: 'confetti', x: 176, y: 40, r: -30, s: 0.5, c: { a: '#7aa8ff' } },
    ],
    fx: [
      { motifs: [{ m: 'balloon' }, { m: 'balloon', c: { a: '#7aa8ff' } }, { m: 'balloon', c: { a: '#ffd24d' } }, { m: 'balloon', c: { a: '#5fe0b0' } }], anim: 'rise', count: 7, size: [30, 46] },
      {
        motifs: [{ m: 'confetti' }, { m: 'confetti', c: { a: '#7aa8ff' } }, { m: 'confetti', c: { a: '#ffd24d' } }, { m: 'confetti', c: { a: '#5fe0b0' } }],
        anim: 'fall',
        count: 18,
        size: [8, 12],
      },
    ],
    glyph: 'balloon',
  },
}

/** SVG markup for one motif, colored. */
export function motifSvg(m: Motif, colors: Colors): string {
  return (MOTIFS[m] as Part[])
    .map((p) => {
      if (p.stroke) return `<path d="${p.d}" fill="none" stroke="${colors[p.c] ?? '#888'}" stroke-width="${p.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
      const outline = colors.outline && OUTLINED.has(p.c) ? ` stroke="${colors.outline}" stroke-width="0.9"` : ''
      return `<path d="${p.d}" fill="${colors[p.c] ?? '#888'}"${outline}/>`
    })
    .join('')
}

/** Light or dark, following data-theme on <html>. */
export function useSeasonMode(): 'dark' | 'light' {
  const read = (): 'dark' | 'light' => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const [mode, setMode] = useState(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setMode(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return mode
}

function MotifPaths({ m, colors }: { m: Motif; colors: Colors }) {
  return (
    <>
      {(MOTIFS[m] as Part[]).map((p, i) =>
        p.stroke ? (
          <path key={i} d={p.d} fill="none" stroke={colors[p.c] ?? 'currentColor'} strokeWidth={p.stroke} strokeLinecap="round" strokeLinejoin="round" />
        ) : colors.outline && OUTLINED.has(p.c) ? (
          <path key={i} d={p.d} fill={colors[p.c] ?? 'currentColor'} stroke={colors.outline} strokeWidth={0.9} />
        ) : (
          <path key={i} d={p.d} fill={colors[p.c] ?? 'currentColor'} />
        ),
      )}
    </>
  )
}

/** One motif as an inline SVG element (drifting pieces and checkmarks). */
export function MotifSvg({ m, colors, className }: { m: Motif; colors: Colors; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" className={className} aria-hidden="true">
      <MotifPaths m={m} colors={colors} />
    </svg>
  )
}

/**
 * A motif placed inside a larger SVG scene: `x`, `y` its top-left, `s` its
 * scale from 24 units. `className` animates it around its own center.
 */
export function Piece({ m, colors, x, y, s = 1, r = 0, className }: { m: Motif; colors: Colors; x: number; y: number; s?: number; r?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r} ${12 * s} ${12 * s}) scale(${s})`}>
      <g className={className}>
        <MotifPaths m={m} colors={colors} />
      </g>
    </g>
  )
}

/** The 200×200 background tile for a season and mode, as a CSS url(). */
export function tileCss(season: Season, mode: 'dark' | 'light'): string {
  const art = SEASON_ART[season]
  const base = art.colors[mode]
  const body = art.tile
    .map((t) => `<g transform="translate(${t.x} ${t.y}) rotate(${t.r ?? 0} 12 12) scale(${t.s ?? 1})">${motifSvg(t.m, { ...base, ...(t.c ?? {}) })}</g>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><g opacity="${art.alpha[mode === 'dark' ? 0 : 1]}">${body}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Deterministic pseudo-random numbers, so the drifting pieces sit the same way on every render. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface FxPiece {
  m: Motif
  colors: Colors
  anim: FxAnim
  left: number
  top: number
  size: number
  duration: number
  delay: number
  spin: number
}

const DURATION: Record<FxAnim, [number, number]> = {
  fall: [14, 26],
  snow: [12, 24],
  drift: [26, 44],
  twinkle: [3, 7],
  burst: [5, 9],
  rise: [16, 28],
  flutter: [18, 30],
}

/** The drifting pieces for a season: positions, sizes and timings. */
export function fxPieces(season: Season, mode: 'dark' | 'light'): FxPiece[] {
  const art = SEASON_ART[season]
  const rand = rng(season.length * 7919 + 17)
  const out: FxPiece[] = []
  for (const group of art.fx) {
    const [dmin, dmax] = DURATION[group.anim]
    for (let i = 0; i < group.count; i++) {
      const pick = group.motifs[i % group.motifs.length]!
      const duration = dmin + rand() * (dmax - dmin)
      out.push({
        m: pick.m,
        colors: { ...art.colors[mode], ...(pick.c ?? {}) },
        anim: group.anim,
        // Spread evenly across the width, with a little jitter.
        left: ((i + 0.2 + rand() * 0.6) / group.count) * 100,
        top: rand() * 90,
        size: group.size[0] + rand() * (group.size[1] - group.size[0]),
        duration,
        // Negative delays: already mid-way when the screen opens.
        delay: -rand() * duration,
        spin: (rand() - 0.5) * 540,
      })
    }
  }
  return out
}
