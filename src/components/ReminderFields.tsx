import { isNative } from '../lib/native'
import type { ReminderSettings, ReminderTone } from '../types'
import { TimeField } from './ProfileFields'
import { Segmented, Toggle } from './ui'

const TONES: { value: ReminderTone; label: string }[] = [
  { value: 'coach', label: 'Coach' },
  { value: 'drill', label: 'Drill sergeant' },
  { value: 'buddy', label: 'Buddy' },
]

const SAMPLE: Record<ReminderTone, string> = {
  coach: '“Pull today, about 55 min. Future you says thanks.”',
  drill: '“Pull doesn’t care how you feel. Go.”',
  buddy: '“Pull today! Your muscles called, they’re bored.”',
}

export function ReminderFields({ value, onChange }: { value: ReminderSettings; onChange: (r: ReminderSettings) => void }) {
  const set = (patch: Partial<ReminderSettings>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-3">
      {!isNative() && <p className="rounded-xl bg-warn/10 p-3 text-sm text-warn">Reminders only ring in the Android app, not in a browser.</p>}
      <Toggle label="Training-day reminder" hint="On days with a workout or cardio planned." checked={value.workout} onChange={(workout) => set({ workout })} />
      {value.workout && <TimeField label="Remind me at" value={value.workoutTime} onChange={(workoutTime) => set({ workoutTime })} />}
      <Toggle label="Nudge if I haven’t trained" hint="Only if nothing is logged by then. Finishing a workout cancels it." checked={value.missed} onChange={(missed) => set({ missed })} />
      {value.missed && <TimeField label="Nudge at" value={value.missedTime} onChange={(missedTime) => set({ missedTime })} />}
      <Toggle label="Morning weigh-in" checked={value.weighIn} onChange={(weighIn) => set({ weighIn })} />
      {value.weighIn && <TimeField label="Weigh-in at" value={value.weighInTime} onChange={(weighInTime) => set({ weighInTime })} />}
      {(value.workout || value.missed || value.weighIn) && (
        <div>
          <p className="mb-1 text-sm font-medium">Tone</p>
          <Segmented label="Reminder tone" value={value.tone} onChange={(tone) => set({ tone })} options={TONES} />
          <p className="mt-1 text-sm text-muted">{SAMPLE[value.tone]}</p>
        </div>
      )}
    </div>
  )
}
