import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export const useDailyLogs = () => useLiveQuery(() => db.dailyLogs.orderBy('date').toArray(), [])
export const useMeasurements = () => useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])
export const useCardio = () => useLiveQuery(() => db.cardio.orderBy('date').reverse().toArray(), [])
export const useWorkouts = () => useLiveQuery(() => db.workouts.orderBy('date').toArray(), [])
export const useReviews = () => useLiveQuery(() => db.weeklyReviews.toArray(), [])
export const usePhotos = () => useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), [])

/** Most recent logged bodyweight, for bodyweight-plus e1RM. */
export const useLatestBodyweight = () =>
  useLiveQuery(async () => (await db.dailyLogs.orderBy('date').reverse().filter((d) => d.weightLb !== undefined).first())?.weightLb, [])
