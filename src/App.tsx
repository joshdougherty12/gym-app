import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppBanners } from './components/AppBanners'
import { BottomNav } from './components/BottomNav'
import { db } from './db/db'
import { useSessions, useSettings } from './db/repo'
import { useReminderSync } from './hooks/useReminderSync'
import { useTheme } from './hooks/useTheme'
import { BodyScreen } from './screens/BodyScreen'
import { FoodScreen } from './screens/FoodScreen'
import { PlanScreen } from './screens/PlanScreen'
import { Placeholder } from './screens/Placeholder'
import { ProgressScreen } from './screens/ProgressScreen'
import { Week12Screen } from './screens/Week12Screen'
import { ProgramScreen } from './screens/ProgramScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { TodayScreen } from './screens/TodayScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'

function Shell() {
  const { pathname } = useLocation()
  const settings = useSettings()
  const sessions = useSessions()
  const workoutCount = useLiveQuery(() => db.workouts.count(), [])
  useReminderSync(settings, sessions)
  // A brand-new install (no profile, nothing logged) starts with setup. Decided
  // once when the app opens, so finishing setup never bounces back into it.
  const [setup, setSetup] = useState<'unknown' | 'redirect' | 'done'>('unknown')
  const needsSetup = settings !== undefined && workoutCount !== undefined && workoutCount === 0 && !settings.profile
  // Workout and setup are full-screen: no tab bar.
  const showNav = pathname !== '/workout' && pathname !== '/welcome'
  if (setup === 'unknown' && settings !== undefined && workoutCount !== undefined) setSetup(needsSetup ? 'redirect' : 'done')
  if (setup === 'redirect') {
    if (pathname === '/welcome' || pathname === '/settings') setSetup('done')
    else return <Navigate to="/welcome" replace />
  }
  return (
    <>
      <AppBanners />
      <main>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/workout" element={<WorkoutScreen />} />
          <Route path="/workout/summary/:id" element={<SummaryScreen />} />
          <Route path="/program" element={<ProgramScreen />} />
          <Route path="/program/session/:id" element={<SessionScreen />} />
          <Route path="/food" element={<FoodScreen />} />
          <Route path="/food/plan" element={<PlanScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/body" element={<BodyScreen />} />
          <Route path="/week12" element={<Week12Screen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Placeholder title="Not found" text="Nothing here." />} />
        </Routes>
      </main>
      {showNav && <BottomNav />}
    </>
  )
}

export default function App() {
  const settings = useSettings()
  useTheme(settings?.theme)

  // Ask the browser not to evict this app's data under storage pressure.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined)
  }, [])

  // Hash routing: works on any static host (GitHub Pages) with no rewrites.
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
