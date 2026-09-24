import { HashRouter, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { useSettings } from './db/repo'
import { useTheme } from './hooks/useTheme'
import { Placeholder } from './screens/Placeholder'
import { ProgramScreen } from './screens/ProgramScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'

export default function App() {
  const settings = useSettings()
  useTheme(settings?.theme)

  // Hash routing: works on any static host (GitHub Pages) with no rewrites.
  return (
    <HashRouter>
      <main>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/program" element={<ProgramScreen />} />
          <Route path="/program/session/:id" element={<SessionScreen />} />
          <Route path="/progress" element={<Placeholder title="Progress" text="Charts for lifts, volume and adherence arrive in phase 5." />} />
          <Route path="/body" element={<Placeholder title="Body" text="Weight, waist and photos arrive in phase 4." />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Placeholder title="Not found" text="Nothing here." />} />
        </Routes>
      </main>
      <BottomNav />
    </HashRouter>
  )
}
