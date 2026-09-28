import { useEffect } from 'react'
import { useAccentStore } from '../store/accent'
import type { AccentPref, ThemePref } from '../types'

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

/** Applies the accent color (data-accent on <html>; the CSS swaps the tokens). */
export function useAccent(accent: AccentPref | undefined) {
  const setStore = useAccentStore((s) => s.set)
  useEffect(() => {
    if (!accent) return
    document.documentElement.dataset.accent = accent
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
