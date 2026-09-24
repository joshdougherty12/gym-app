import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { useSettings } from './db/repo'
import { useTheme } from './hooks/useTheme'
import { Placeholder } from './screens/Placeholder'
import { ProgramScreen } from './screens/ProgramScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { TodayScreen } from './screens/TodayScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'

function Shell() {
  const { pathname } = useLocation()
  // The workout screen is full-screen: no tab bar, the rest timer lives there.
  const showNav = pathname !== '/workout'
  return (
    <>
      <main>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout" element={<WorkoutScreen />} />
          <Route path="/workout/summary/:id" element={<SummaryScreen />} />
          <Route path="/program" element={<ProgramScreen />} />
          <Route path="/program/session/:id" element={<SessionScreen />} />
          <Route path="/progress" element={<Placeholder title="Progress" text="Charts for lifts, volume and adherence arrive in phase 5." />} />
          <Route path="/body" element={<Placeholder title="Body" text="Weight trend, waist and photos arrive in phase 4. Log today's weight in the Today check-in." />} />
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
