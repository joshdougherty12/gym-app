import { useEffect } from 'react'
import { useAccentStore } from '../store/accent'
import { isSeason, type ThemeId } from '../lib/accent'
import { tileCss } from '../lib/seasonArt'
import type { ThemePref } from '../types'

/** The browser and status bar color: the page background of the current theme and accent. */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches)
  const mode = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = mode
  syncThemeColor()
}

/**
 * Applies the look (data-accent on <html>; the CSS swaps the tokens). A
 * seasonal theme also gets data-season and its background patterns for both
 * modes as CSS variables.
 */
export function useAccent(accent: ThemeId | undefined) {
  const setStore = useAccentStore((s) => s.set)
  useEffect(() => {
    if (!accent) return
    const root = document.documentElement
    root.dataset.accent = accent
    if (isSeason(accent)) {
      root.dataset.season = accent
      root.style.setProperty('--season-tile-dark', tileCss(accent, 'dark'))
      root.style.setProperty('--season-tile-light', tileCss(accent, 'light'))
    } else {
      delete root.dataset.season
      root.style.removeProperty('--season-tile-dark')
      root.style.removeProperty('--season-tile-light')
    }
    syncThemeColor()
    setStore(accent)
    try {
      localStorage.setItem('cutline-accent', accent) // pre-paint hint only
    } catch {
      /* storage unavailable */
    }
  }, [accent, setStore])
}

/** Applies the theme preference and follows the system when set to "system". */
export function useTheme(pref: ThemePref | undefined) {
  useEffect(() => {
    if (!pref) return
    apply(pref)
    try {
      localStorage.setItem('cutline-theme', pref) // pre-paint hint only; settings live in IndexedDB
    } catch {
      /* storage unavailable: the app still themes correctly after load */
    }
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])
}
