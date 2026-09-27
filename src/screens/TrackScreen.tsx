import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { RouteSvg } from '../components/activity/RouteSvg'
import { Icon } from '../components/Icon'
import { Button, Card, Loading, Segmented, Sheet, Toggle } from '../components/ui'
import { updateSettings, useSettings } from '../db/repo'
import { useWakeLock } from '../hooks/useWakeLock'
import { beep, primeAudio } from '../lib/alarm'
import { APP_NAME } from '../lib/brand'
import { distUnit, fmtDistance, fmtDuration, fmtElevation, fmtRate } from '../lib/activity/format'
import { toRoute } from '../lib/activity/route'
import { ACTIVITY, ACTIVITY_TYPES, summarize, type TrackStats } from '../lib/activity/track'
import { timestamp } from '../lib/id'
import { isNative } from '../lib/native'
import { ActivityTracker } from '../tracker/native'
import { TrackerError, useTracker } from '../tracker/store'
import type { ActivityType, Settings } from '../types'

const RouteMap = lazy(() => import('../components/activity/RouteMap'))

export const IPHONE_NOTE = `On iPhone, keep ${APP_NAME} open with the screen on — web apps can't track in the background.`

/** Start, track and finish a run, walk, ride or hike. */
export function TrackScreen() {
  const settings = useSettings()
  const { loaded, session, load } = useTracker()
  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])
  if (!settings || !loaded) return <Loading />
  return session ? <LiveView settings={settings} /> : <StartView settings={settings} />
}

function Intro({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        {APP_NAME} records your route with the phone’s GPS and shows distance, pace, splits and a map. Each finished activity also counts as cardio.
      </p>
      <p>
        <strong>Your location stays on this phone.</strong> Nothing is uploaded. The only network use is loading map tiles from OpenStreetMap. If you share workouts with a partner, they see the
        type, distance, time and pace, never the route or where you started.
      </p>
      {isNative() ? (
        <p>Tracking keeps going with the screen off, and a notification shows while it runs. Allow location “While using the app”: {APP_NAME} never asks for “all the time”.</p>
      ) : (
        <p>{IPHONE_NOTE}</p>
      )}
      <Button variant="primary" className="w-full" onClick={onDone}>
        Got it
      </Button>
    </div>
  )
}

function StartView({ settings }: { settings: Settings }) {
  const pref = settings.activity
  const [type, setType] = useState<ActivityType>(pref.lastType)
  const [error, setError] = useState<TrackerError | null>(null)
  const [busy, setBusy] = useState(false)
  const [intro, setIntro] = useState(!pref.introSeen)
  const start = useTracker((s) => s.start)
  const unit = distUnit(settings.units)
  const setPref = (p: Partial<Settings['activity']>) => void updateSettings({ activity: { ...pref, ...p } })

  const go = async () => {
    setBusy(true)
    setError(null)
    primeAudio()
    try {
      setPref({ lastType: type })
      await start({ type, autoPause: pref.autoPause, splitCue: pref.splitCue, units: settings.units })
    } catch (e) {
      setError(e instanceof TrackerError ? e : new TrackerError('failed', e instanceof Error ? e.message : 'Could not start tracking.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-[max(1rem,var(--sat))] pb-28">
      <header className="mb-4 flex items-end gap-2">
        <Link to="/" aria-label="Back" className="-ml-2 grid size-11 place-items-center rounded-full text-muted">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="num min-w-0 flex-1 text-4xl leading-none font-bold tracking-tight uppercase">Track</h1>
        <Link to="/activities" className="grid min-h-11 place-items-center px-2 text-sm font-semibold text-accent">
          History
        </Link>
      </header>

      {!isNative() && (
        <p role="note" className="mb-3 rounded-2xl border border-warn bg-warn/10 p-3 text-sm text-warn">
          {IPHONE_NOTE}
        </p>
      )}

      <Card>
        <Segmented label="Activity" value={type} onChange={setType} options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY[t].label }))} />
        <div className="mt-3 space-y-1">
          <Toggle label="Auto-pause" hint="Pauses the clock when you stop (lights, traffic)." checked={pref.autoPause} onChange={(autoPause) => setPref({ autoPause })} />
          <Toggle
            label={isNative() ? `Buzz and beep each ${unit === 'mi' ? 'mile' : 'km'}` : `Beep each ${unit === 'mi' ? 'mile' : 'km'}`}
            hint={isNative() ? undefined : 'Only while this page is open.'}
            checked={pref.splitCue}
            onChange={(splitCue) => setPref({ splitCue })}
          />
        </div>
        <button type="button" disabled={busy} onClick={() => void go()} className="mt-4 min-h-20 w-full rounded-2xl bg-accent text-2xl font-bold tracking-wide text-accent-ink uppercase disabled:opacity-50">
          {busy ? 'Starting…' : `Start ${ACTIVITY[type].noun}`}
        </button>
        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-bad/10 p-3 text-sm text-bad">
            <p>{error.message}</p>
            {isNative() && (error.code === 'denied' || error.code === 'precise') && (
              <Button className="mt-2 w-full" onClick={() => void ActivityTracker.openAppSettings()}>
                Open app settings
              </Button>
            )}
            {isNative() && error.code === 'gps-off' && (
              <Button className="mt-2 w-full" onClick={() => void ActivityTracker.openLocationSettings()}>
                Open location settings
              </Button>
            )}
          </div>
        )}
      </Card>
      <p className="mt-3 px-1 text-xs text-muted">Location stays on this phone. Map tiles load from OpenStreetMap.</p>

      <Sheet
        open={intro}
        onClose={() => {
          setIntro(false)
          setPref({ introSeen: true })
        }}
        title="GPS tracking"
      >
        <Intro
          onDone={() => {
            setIntro(false)
            setPref({ introSeen: true })
          }}
        />
      </Sheet>
    </div>
  )
}

function useNow(ms: number): number {
  const [now, setNow] = useState(timestamp)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

function Stat({ label, value, unit, big = false }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className={`num leading-none font-bold ${big ? 'text-5xl' : 'text-3xl'}`}>
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
      </p>
    </div>
  )
}

/** Press and hold to finish; a tap (or keyboard) asks to confirm instead. */
function HoldToFinish({ onFinish, onTap }: { onFinish: () => void; onTap: () => void }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }
  return (
    <button
      type="button"
      aria-label="Finish. Hold to finish now, or tap to confirm."
      onPointerDown={() => {
        fired.current = false
        setHolding(true)
        timer.current = window.setTimeout(() => {
          fired.current = true
          setHolding(false)
          onFinish()
        }, 1200)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={() => {
        if (!fired.current) onTap()
        fired.current = false
      }}
      className="relative min-h-16 overflow-hidden rounded-2xl bg-surface-2 text-lg font-bold uppercase"
    >
      <span className={`absolute inset-y-0 left-0 bg-bad/30 ${holding ? 'w-full transition-[width] duration-[1200ms] ease-linear' : 'w-0'}`} aria-hidden />
      <span className="relative">{holding ? 'Keep holding…' : 'Hold to finish'}</span>
    </button>
  )
}

function LiveView({ settings }: { settings: Settings }) {
  const { session, points, gpsError, pause, resume, finish, discard, poll } = useTracker()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const showMap = settings.activity.showMap
  const units = settings.units
  useWakeLock(!isNative())

  // Android: pull new fixes every second while visible.
  useEffect(() => {
    if (!isNative()) return
    const tick = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    tick()
    const id = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [poll])

  const stats: TrackStats | null = useMemo(
    () => (session ? summarize({ type: session.type, startedAt: session.startedAt, now, events: session.events, points, autoPause: session.autoPause, splitM: session.splitM }) : null),
    [session, points, now],
  )
  const liveRoute = useMemo(() => (stats && session ? toRoute(stats.track, session.startedAt, 2) : []), [stats, session])

  // Web: beep at each split (Android buzzes natively, even with the screen off).
  const splitCount = stats?.splits.length ?? 0
  const lastCount = useRef(splitCount)
  useEffect(() => {
    if (splitCount > lastCount.current && session?.splitCue && !isNative()) beep()
    lastCount.current = splitCount
  }, [splitCount, session?.splitCue])

  if (!session || !stats) return <Loading />
  const prof = ACTIVITY[session.type]
  const unit = distUnit(units)
  const cur = fmtRate(session.type, stats.currentSpeedMps, units)
  const avg = fmtRate(session.type, stats.distanceM > 0 ? stats.avgSpeedMps : null, units)
  const splitAvg = fmtRate(session.type, stats.currentSplit.movingMs > 0 ? stats.currentSplit.distanceM / (stats.currentSplit.movingMs / 1000) : null, units)
  const noFix = stats.lastFixAt === undefined || now - stats.lastFixAt > 12_000
  const status =
    stats.state === 'paused'
      ? { text: 'Paused', cls: 'bg-warn/15 text-warn' }
      : gpsError && !gpsError.startsWith('Waiting')
        ? { text: gpsError, cls: 'bg-bad/15 text-bad' }
        : noFix
          ? { text: points.length ? 'GPS signal lost…' : 'Waiting for GPS…', cls: 'bg-warn/15 text-warn' }
          : stats.state === 'autopaused'
            ? { text: 'Auto-paused', cls: 'bg-warn/15 text-warn' }
            : { text: `Tracking ${prof.noun}`, cls: 'bg-good/15 text-good' }

  const doFinish = async () => {
    if (saving) return
    setSaving(true)
    setConfirmFinish(false)
    try {
      const id = await finish()
      navigate(id ? `/activity/${id}` : '/', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-[max(1rem,var(--sat))] pb-10">
      <div className="mb-3 flex items-center gap-2">
        <Link to="/" aria-label="Back to Today (tracking continues)" className="-ml-2 grid size-11 place-items-center rounded-full text-muted">
          <Icon name="chevronLeft" />
        </Link>
        <p role="status" className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${status.cls}`}>
          {status.text}
        </p>
      </div>

      {!isNative() && <p className="mb-3 text-xs text-warn">{IPHONE_NOTE}</p>}

      <Stat label="Moving time" value={fmtDuration(stats.movingMs)} big />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Distance" value={fmtDistance(stats.distanceM, units)} unit={unit} big />
        <Stat label={prof.showSpeed ? 'Speed' : 'Pace'} value={cur.value} unit={cur.unit} big />
        <Stat label={prof.showSpeed ? 'Avg speed' : 'Avg pace'} value={avg.value} unit={avg.unit} />
        <Stat label={`${unit === 'mi' ? 'Mile' : 'Km'} ${stats.currentSplit.index}`} value={fmtDuration(stats.currentSplit.movingMs)} unit={splitAvg.value !== '--:--' && splitAvg.value !== '--' ? `${splitAvg.value}${splitAvg.unit}` : undefined} />
        <Stat label="Elapsed" value={fmtDuration(stats.elapsedMs)} />
        <Stat label="Climb (approx.)" value={stats.elevationGainM !== undefined ? fmtElevation(stats.elevationGainM, units) : '--'} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.state === 'paused' ? (
          <button type="button" onClick={() => void resume()} className="min-h-16 rounded-2xl bg-accent text-lg font-bold text-accent-ink uppercase">
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => void pause()} className="min-h-16 rounded-2xl bg-accent text-lg font-bold text-accent-ink uppercase">
            Pause
          </button>
        )}
        <HoldToFinish onFinish={() => void doFinish()} onTap={() => setConfirmFinish(true)} />
      </div>
      {stats.state === 'paused' && (
        <Button variant="danger" className="mt-2 w-full" onClick={() => setConfirmDiscard(true)}>
          Discard {prof.noun}
        </Button>
      )}

      <div className="mt-4 flex items-center gap-2">
        <p className="flex-1 text-xs font-bold tracking-[0.14em] text-muted uppercase">Map</p>
        <Button variant="ghost" onClick={() => void updateSettings({ activity: { ...settings.activity, showMap: !showMap } })}>
          {showMap ? 'Hide map' : 'Show map'}
        </Button>
      </div>
      {showMap && (
        <Suspense fallback={<RouteSvg route={liveRoute} className="h-64" />}>
          <RouteMap route={liveRoute} live className="h-64" />
        </Suspense>
      )}

      {stats.splits.length > 0 && (
        <Card className="mt-3">
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Splits</p>
          <ul className="mt-2 space-y-1">
            {stats.splits.map((s) => {
              const r = fmtRate(session.type, s.distanceM / (s.movingMs / 1000), units)
              return (
                <li key={s.index} className="num flex items-baseline gap-2 text-lg">
                  <span className="w-16 text-muted">
                    {unit} {s.index}
                  </span>
                  <span className="flex-1">{fmtDuration(s.movingMs)}</span>
                  <span className="text-muted">
                    {r.value}
                    {r.unit}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Sheet open={confirmFinish} onClose={() => setConfirmFinish(false)} title={`Finish ${prof.noun}?`}>
        <p className="text-sm">
          {fmtDistance(stats.distanceM, units)} {unit} in {fmtDuration(stats.movingMs)}. It’s saved to your history and counts as cardio.
        </p>
        <div className="mt-3 grid gap-2">
          <Button variant="primary" disabled={saving} onClick={() => void doFinish()}>
            Finish and save
          </Button>
          <Button onClick={() => setConfirmFinish(false)}>Keep going</Button>
        </div>
      </Sheet>

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title={`Discard ${prof.noun}?`}>
        <p className="text-sm">The route and times are deleted. This can’t be undone.</p>
        <div className="mt-3 grid gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setConfirmDiscard(false)
              void discard().then(() => navigate('/', { replace: true }))
            }}
          >
            Discard
          </Button>
          <Button onClick={() => setConfirmDiscard(false)}>Keep it</Button>
        </div>
      </Sheet>
    </div>
  )
}
