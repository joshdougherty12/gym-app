import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AppBanners } from './components/AppBanners'
import { LoveNote } from './components/LoveNote'
import { BottomNav } from './components/BottomNav'
import { db } from './db/db'
import { useSessions, useSettings } from './db/repo'
import { useReminderSync } from './hooks/useReminderSync'
import { useAccent, useTheme } from './hooks/useTheme'
import { coupleRole, resolveAccent } from './lib/accent'
import { usePartner } from './partner/hooks'
import { usePartnerSync } from './partner/useSync'
import { useStepSync } from './hooks/useStepSync'
import { StepImportScreen } from './screens/StepImportScreen'
import { ActivitiesScreen, ActivityScreen } from './screens/ActivityScreen'
import { PartnerActivityScreen } from './screens/PartnerActivityScreen'
import { TrackScreen } from './screens/TrackScreen'
import { useTracker } from './tracker/store'
import { BodyScreen } from './screens/BodyScreen'
import { FoodScreen } from './screens/FoodScreen'
import { LinkCodeRoute, LinkScreen } from './screens/LinkScreen'
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

/** On opening the app, pick up an activity in progress (or save one that was finished but not saved) and show it. */
function useActivityRecovery(pathname: string) {
  const navigate = useNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    void useTracker
      .getState()
      .load()
      .then(() => {
        if (useTracker.getState().session && pathname === '/') navigate('/activity/track')
      })
  }, [navigate, pathname])
}

function Shell() {
  const { pathname } = useLocation()
  useActivityRecovery(pathname)
  const settings = useSettings()
  const sessions = useSessions()
  const workoutCount = useLiveQuery(() => db.workouts.count(), [])
  useReminderSync(settings, sessions)
  usePartnerSync()
  useStepSync()
  // A brand-new install (no profile, nothing logged) starts with setup. Decided
  // once when the app opens, so finishing setup never bounces back into it.
  const [setup, setSetup] = useState<'unknown' | 'redirect' | 'done'>('unknown')
  const needsSetup = settings !== undefined && workoutCount !== undefined && workoutCount === 0 && !settings.profile
  // Workout and setup are full-screen: no tab bar.
  const showNav = pathname !== '/workout' && pathname !== '/welcome' && pathname !== '/activity/track'
  if (setup === 'unknown' && settings !== undefined && workoutCount !== undefined) setSetup(needsSetup ? 'redirect' : 'done')
  if (setup === 'redirect') {
    // A partner link opened on a new phone goes to the link screen first; it continues to setup after linking.
    if (pathname === '/welcome' || pathname === '/settings' || pathname.startsWith('/link')) setSetup('done')
    else return <Navigate to="/welcome" replace />
  }
  return (
    <>
      <AppBanners />
      <LoveNote />
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
          <Route path="/steps/import" element={<StepImportScreen />} />
          <Route path="/activity/track" element={<TrackScreen />} />
          <Route path="/activity/:id" element={<ActivityScreen />} />
          <Route path="/activities" element={<ActivitiesScreen />} />
          <Route path="/partner/activity/:id" element={<PartnerActivityScreen />} />
          <Route path="/link" element={<LinkScreen />} />
          <Route path="/link/:code" element={<LinkCodeRoute />} />
          <Route path="*" element={<Placeholder title="Not found" text="Nothing here." />} />
        </Routes>
      </main>
      {showNav && <BottomNav />}
    </>
  )
}

export default function App() {
  const settings = useSettings()
  const partner = usePartner()
  useTheme(settings?.theme)
  const role =
    settings && partner ? coupleRole(settings.partner.name.trim() || settings.profile?.name, partner.partner?.name, partner.link?.status === 'linked') : null
  useAccent(settings && partner ? resolveAccent(settings.accent, role) : undefined)

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
