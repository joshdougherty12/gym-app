import { useLocation } from 'react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isDemoMode } from '../db/db'
import { exitDemoMode } from '../dev/demoMode'

/**
 * Top-of-screen banners: demo mode, and "new version ready". Updates never
 * reload on their own, and the prompt is hidden during a workout so a deploy
 * can't interrupt a set.
 */
export function AppBanners() {
  const { pathname } = useLocation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })
  const demo = isDemoMode()
  const showUpdate = needRefresh && pathname !== '/workout'
  if (!demo && !showUpdate) return null
  return (
    <div className="sticky top-0 z-40 space-y-px">
      {demo && (
        <div className="flex items-center gap-2 bg-warn px-4 py-2 pt-[max(0.5rem,var(--sat))] text-sm font-bold text-bg">
          <span className="flex-1">DEMO DATA: your real logs are untouched</span>
          <button type="button" onClick={() => exitDemoMode()} className="min-h-11 rounded-lg bg-bg px-3 text-warn">
            Exit demo
          </button>
        </div>
      )}
      {showUpdate && (
        <div className="flex items-center gap-2 bg-accent px-4 py-2 pt-[max(0.5rem,var(--sat))] text-sm font-bold text-accent-ink" role="status">
          <span className="flex-1">A new version is ready.</span>
          <button type="button" onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-lg bg-accent-ink px-3 text-accent">
            Reload
          </button>
        </div>
      )}
    </div>
  )
}
