import { useEffect } from 'react'
import type { ThemePref } from '../types'

const THEME_COLOR = { dark: '#121416', light: '#f6f4f0' } as const

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches)
  const mode = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[mode])
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
