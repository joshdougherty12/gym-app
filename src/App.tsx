import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router'
import { AppBanners } from './components/AppBanners'
import { BottomNav } from './components/BottomNav'
import { useSettings } from './db/repo'
import { useTheme } from './hooks/useTheme'
import { BodyScreen } from './screens/BodyScreen'
import { Placeholder } from './screens/Placeholder'
import { ProgressScreen } from './screens/ProgressScreen'
import { Week12Screen } from './screens/Week12Screen'
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
      <AppBanners />
      <main>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout" element={<WorkoutScreen />} />
          <Route path="/workout/summary/:id" element={<SummaryScreen />} />
          <Route path="/program" element={<ProgramScreen />} />
          <Route path="/program/session/:id" element={<SessionScreen />} />
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
