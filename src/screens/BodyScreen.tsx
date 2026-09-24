import { useEffect, useId, useMemo, useState } from 'react'
import { CARDIO_KINDS, CardioQuickLog } from '../components/CardioQuickLog'
import { CheckIn } from '../components/CheckIn'
import { TargetBar, TrendChart } from '../components/charts'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, Loading, Screen, SectionTitle, Segmented, Sheet } from '../components/ui'
import { WeeklyReviewCard } from '../components/WeeklyReviewCard'
import { db } from '../db/db'
import { useSessions, useSettings } from '../db/repo'
import { useCardio, useDailyLogs, useMeasurements, usePhotos } from '../hooks/useData'
import { daysBetween, isIsoDate, shortDate, todayIso } from '../lib/dates'
import { newId } from '../lib/id'
import { compressImage } from '../lib/image'
import { movingAverage } from '../lib/movingAverage'
import { displayLength, displayWeight, formatNumber, inputLengthToIn, lengthUnit, weightUnit } from '../lib/units'
import type { Photo, PhotoAngle, Settings } from '../types'

const r1 = (n: number) => Math.round(n * 10) / 10

export function BodyScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const logs = useDailyLogs()
  const waist = useMeasurements()
  if (!settings || !sessions || !logs || !waist) return <Loading />
  const u = settings.units

  const weights = logs.flatMap((d) => (d.weightLb !== undefined ? [{ date: d.date, value: d.weightLb }] : []))
  const avg = movingAverage(weights, 7)
  const latest = weights[weights.length - 1]
  const latestAvg = avg[avg.length - 1]
  const weekAgoAvg = latestAvg ? [...avg].reverse().find((p) => daysBetween(p.date, latestAvg.date) >= 7) : undefined
  const recent = weights.slice(-60)
  const avgByDate = new Map(avg.map((p) => [p.date, p.value]))
  const weightRows = recent.map((w) => ({ label: shortDate(w.date), weight: displayWeight(w.value, u), avg: r1(displayWeight(avgByDate.get(w.date) ?? w.value, u)) }))

  const lastWaist = waist[waist.length - 1]
  const firstWaist = waist[0]
  const waistDue = !lastWaist || daysBetween(lastWaist.date, todayIso()) >= 7

  return (
    <Screen title="Body" subtitle="Weight, waist, photos, nutrition">
      <WeeklyReviewCard settings={settings} sessions={sessions} />

      <SectionTitle>Weight</SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Latest" value={latest ? formatNumber(r1(displayWeight(latest.value, u))) : '—'} unit={weightUnit(u)} />
          <Stat label="7-day avg" value={latestAvg ? formatNumber(r1(displayWeight(latestAvg.value, u))) : '—'} unit={weightUnit(u)} />
          <Stat
            label="Avg vs 1 wk"
            value={latestAvg && weekAgoAvg ? `${latestAvg.value - weekAgoAvg.value > 0 ? '+' : latestAvg.value < weekAgoAvg.value ? '−' : ''}${formatNumber(r1(Math.abs(displayWeight(latestAvg.value - weekAgoAvg.value, u))))}` : '—'}
            unit={weightUnit(u)}
          />
        </div>
        <div className="mt-3">
          <TrendChart
            title="Bodyweight with 7-day moving average"
            data={weightRows}
            series={[
              { key: 'weight', name: 'Weigh-in', color: 's2', dotsOnly: true },
              { key: 'avg', name: '7-day average', color: 's1' },
            ]}
            format={(v) => `${formatNumber(r1(v))} ${weightUnit(u)}`}
            empty="No weigh-ins yet. Weigh in each morning after the bathroom, before eating, and log it in the check-in."
          />
        </div>
        <DayEditor settings={settings} />
      </Card>

      <SectionTitle>Waist</SectionTitle>
      <Card>
        <div className="flex items-baseline gap-3">
          <div className="num text-4xl font-bold">
            {lastWaist ? formatNumber(displayLength(lastWaist.waistIn, u)) : '—'} <span className="text-base text-muted">{lengthUnit(u)}</span>
          </div>
          {lastWaist && firstWaist && lastWaist !== firstWaist && (
            <span className={`num text-xl ${lastWaist.waistIn < firstWaist.waistIn ? 'text-good' : 'text-muted'}`}>
              {lastWaist.waistIn <= firstWaist.waistIn ? '−' : '+'}
              {formatNumber(displayLength(Math.abs(lastWaist.waistIn - firstWaist.waistIn), u))} since {shortDate(firstWaist.date)}
            </span>
          )}
          {waistDue && <Badge tone="accent">Due</Badge>}
        </div>
        <p className="text-xs text-muted">Weekly, same morning each week, tape at the navel, relaxed.</p>
        <div className="mt-3">
          <TrendChart
            title="Waist"
            data={waist.map((m) => ({ label: shortDate(m.date), waist: displayLength(m.waistIn, u) }))}
            series={[{ key: 'waist', name: 'Waist', color: 's1' }]}
            format={(v) => `${formatNumber(v)} ${lengthUnit(u)}`}
            height={160}
            empty="No waist measurements yet."
          />
        </div>
        <WaistForm settings={settings} />
      </Card>

      <SectionTitle>Progress photos</SectionTitle>
      <Photos />

      <SectionTitle>Nutrition</SectionTitle>
      <Nutrition settings={settings} />

      <SectionTitle>Cardio</SectionTitle>
      <CardioLog />
    </Screen>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2">
      <div className="num text-3xl leading-tight font-bold">
        {value}
        {unit && value !== '—' && <span className="text-sm font-medium text-muted"> {unit}</span>}
      </div>
      <div className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</div>
    </div>
  )
}

/** Edit any day's check-in (for missed or wrong entries). */
function DayEditor({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayIso())
  const id = useId()
  return (
    <>
      <Button className="mt-2 w-full" onClick={() => setOpen(true)}>
        Log or edit another day
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit a day">
        <div className="mb-3 flex items-center gap-3">
          <label htmlFor={id} className="flex-1 text-sm font-medium">
            Date
          </label>
          <input
            id={id}
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => {
              if (isIsoDate(e.target.value)) setDate(e.target.value)
            }}
            className="min-h-11 rounded-xl border border-line bg-surface-2 px-3"
          />
        </div>
        <CheckIn date={date} units={settings.units} targets={{ calories: settings.calorieTarget, protein: settings.proteinTargetG, steps: settings.stepGoal }} />
      </Sheet>
    </>
  )
}

function WaistForm({ settings }: { settings: Settings }) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayIso())
  const base = useId()
  const save = async () => {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return
    await db.measurements.put({ date, waistIn: inputLengthToIn(n, settings.units) })
    setValue('')
  }
  return (
    <form
      className="mt-2 flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex-1">
        <label htmlFor={`${base}-w`} className="text-[11px] font-bold tracking-wide text-muted uppercase">
          Waist ({lengthUnit(settings.units)})
        </label>
        <input id={`${base}-w`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="num min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-2xl" />
      </div>
      <div>
        <label htmlFor={`${base}-d`} className="text-[11px] font-bold tracking-wide text-muted uppercase">
          Date
        </label>
        <input id={`${base}-d`} type="date" value={date} max={todayIso()} onChange={(e) => isIsoDate(e.target.value) && setDate(e.target.value)} className="min-h-11 rounded-xl border border-line bg-surface-2 px-2" />
      </div>
      <Button type="submit" variant="primary" disabled={value.trim() === ''}>
        Save
      </Button>
    </form>
  )
}

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

function PhotoImg({ photo, className = '' }: { photo: Photo; className?: string }) {
  const url = useObjectUrl(photo.blob)
  return url ? <img src={url} alt={`${photo.angle} photo, ${shortDate(photo.date)}`} className={`w-full rounded-xl object-cover ${className}`} /> : null
}

const ANGLES: PhotoAngle[] = ['front', 'side', 'back']

function Photos() {
  const photos = usePhotos()
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [busy, setBusy] = useState(false)
  const [compare, setCompare] = useState(false)
  const [a, setA] = useState<string>('')
  const [b, setB] = useState<string>('')
  const [viewing, setViewing] = useState<Photo | null>(null)
  const inputId = useId()
  if (!photos) return null

  const add = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressImage(file)
      await db.photos.put({ id: newId('photo'), date: todayIso(), angle, blob })
    } finally {
      setBusy(false)
    }
  }

  const dates = [...new Set(photos.map((p) => p.date))].sort().reverse()
  const ofAngle = photos.filter((p) => p.angle === angle)
  const pick = (d: string) => ofAngle.find((p) => p.date === d)
  const first = dates[dates.length - 1] ?? ''
  const last = dates[0] ?? ''
  const left = pick(a || first)
  const right = pick(b || last)

  return (
    <Card>
      <Segmented label="Angle" value={angle} onChange={setAngle} options={ANGLES.map((x) => ({ value: x, label: x[0]!.toUpperCase() + x.slice(1) }))} />
      <label htmlFor={inputId} className={`mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent font-bold text-accent-ink ${busy ? 'opacity-50' : ''}`}>
        <Icon name="plus" className="size-5" /> {busy ? 'Saving…' : `Add ${angle} photo for today`}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void add(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p className="mt-1 text-xs text-muted">Stored only on this phone. Same spot, same light, same time of day each time.</p>

      {ofAngle.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No {angle} photos yet.</p>
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {ofAngle.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setViewing(p)} className="block w-full" aria-label={`Open ${p.angle} photo from ${shortDate(p.date)}`}>
                  <PhotoImg photo={p} className="aspect-[3/4]" />
                  <span className="num text-sm text-muted">{shortDate(p.date)}</span>
                </button>
              </li>
            ))}
          </ul>
          {ofAngle.length >= 2 && (
            <Button className="mt-3 w-full" onClick={() => setCompare(true)}>
              Compare two dates
            </Button>
          )}
        </>
      )}

      <Sheet open={compare} onClose={() => setCompare(false)} title={`Compare ${angle}`}>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: a || first, set: setA, photo: left, label: 'Before' },
            { value: b || last, set: setB, photo: right, label: 'After' },
          ].map((side) => (
            <div key={side.label}>
              <label className="text-[11px] font-bold tracking-wide text-muted uppercase">
                {side.label}
                <select value={side.value} onChange={(e) => side.set(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-2 text-sm normal-case">
                  {ofAngle.map((p) => (
                    <option key={p.id} value={p.date}>
                      {shortDate(p.date)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2">{side.photo ? <PhotoImg photo={side.photo} /> : <p className="text-sm text-muted">No photo that day.</p>}</div>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.angle} · ${shortDate(viewing.date)}` : ''}>
        {viewing && (
          <>
            <PhotoImg photo={viewing} />
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={() => {
                if (!window.confirm('Delete this photo?')) return
                void db.photos.delete(viewing.id).then(() => setViewing(null))
              }}
            >
              Delete photo
            </Button>
          </>
        )}
      </Sheet>
    </Card>
  )
}

function Nutrition({ settings }: { settings: Settings }) {
  const logs = useDailyLogs()
  if (!logs) return null
  const today = todayIso()
  const t = logs.find((d) => d.date === today)
  const last7 = logs.filter((d) => daysBetween(d.date, today) >= 0 && daysBetween(d.date, today) < 7)
  const cal = last7.filter((d) => d.calories !== undefined)
  const pro = last7.filter((d) => d.proteinG !== undefined)
  const avgCal = cal.length ? Math.round(cal.reduce((s, d) => s + (d.calories ?? 0), 0) / cal.length) : undefined
  const avgPro = pro.length ? Math.round(pro.reduce((s, d) => s + (d.proteinG ?? 0), 0) / pro.length) : undefined
  const proteinHits = pro.filter((d) => (d.proteinG ?? 0) >= settings.proteinTargetG).length
  return (
    <Card className="space-y-2">
      <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Today</p>
      <TargetBar label="Calories" value={t?.calories ?? 0} max={Math.max(settings.calorieTarget * 1.25, t?.calories ?? 0)} target={settings.calorieTarget} display={t?.calories !== undefined ? t.calories.toLocaleString() : '—'} tone={(t?.calories ?? 0) > settings.calorieTarget ? 'warn' : 'accent'} />
      <TargetBar label="Protein" value={t?.proteinG ?? 0} max={Math.max(settings.proteinTargetG * 1.25, t?.proteinG ?? 0)} target={settings.proteinTargetG} display={t?.proteinG !== undefined ? `${t.proteinG} g` : '—'} tone={(t?.proteinG ?? 0) >= settings.proteinTargetG ? 'good' : 'accent'} />
      <p className="pt-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">Last 7 days</p>
      <p className="text-sm">
        Average <span className="num text-lg">{avgCal !== undefined ? avgCal.toLocaleString() : '—'}</span> kcal (target {settings.calorieTarget.toLocaleString()}) ·{' '}
        <span className="num text-lg">{avgPro ?? '—'}</span> g protein (target {settings.proteinTargetG}) · protein hit {proteinHits}/{pro.length} days
      </p>
      <p className="text-xs text-muted">Log totals in the Today check-in. The weekly review adjusts the calorie target.</p>
    </Card>
  )
}

function CardioLog() {
  const cardio = useCardio()
  const [open, setOpen] = useState(false)
  if (!cardio) return null
  const today = todayIso()
  const weekMin = cardio.filter((c) => daysBetween(c.date, today) < 7 && daysBetween(c.date, today) >= 0).reduce((s, c) => s + c.minutes, 0)
  return (
    <Card>
      <p className="text-sm">
        Last 7 days: <span className="num text-xl">{weekMin}</span> min
      </p>
      <Button className="mt-2 w-full" onClick={() => setOpen(true)}>
        Log cardio
      </Button>
      {cardio.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {cardio.slice(0, 10).map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-2 text-sm">
              <span className="num w-14 text-base">{shortDate(c.date)}</span>
              <span className="flex-1">{CARDIO_KINDS.find((k) => k.value === c.kind)?.label}</span>
              <span className="num text-base">{c.minutes} min</span>
              <button type="button" aria-label="Delete" onClick={() => void db.cardio.delete(c.id)} className="grid size-11 place-items-center text-muted">
                <Icon name="trash" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Log cardio">
        <CardioQuickLog onDone={() => setOpen(false)} />
      </Sheet>
    </Card>
  )
}
