import { CutlineDB, DEMO_DB_NAME, setDemoFlag } from '../db/db'
import { todayIso } from '../lib/dates'
import { generateDemo } from './demoData'

/** Fill the separate demo database with ~10 weeks of history and switch to it. */
export async function enterDemoMode(): Promise<void> {
  const demo = new CutlineDB(DEMO_DB_NAME)
  await demo.delete()
  await demo.open()
  const d = generateDemo(todayIso())
  await demo.transaction('rw', [demo.settings, demo.workouts, demo.dailyLogs, demo.measurements, demo.cardio], async () => {
    await demo.settings.put({ ...d.settings, id: 'app' })
    await demo.workouts.bulkPut(d.workouts)
    await demo.dailyLogs.bulkPut(d.dailyLogs)
    await demo.measurements.bulkPut(d.measurements)
    await demo.cardio.bulkPut(d.cardio)
  })
  demo.close()
  setDemoFlag(true)
  window.location.reload()
}

/**
 * Leave demo mode. The demo database is still open on this page (live queries
 * reopen it), so it is deleted on the next start instead, when nothing uses it.
 * Real data was never touched.
 */
export function exitDemoMode(): void {
  setDemoFlag(false)
  window.location.reload()
}
