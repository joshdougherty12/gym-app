import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

/** True inside the installed Android app, false in a browser or the PWA. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

const REST_ID = 4201
const CHANNEL = 'rest-timer'
let ready: Promise<boolean> | null = null

/** Ask for notification permission once and create a loud, vibrating channel for the rest timer. */
export function initRestAlarm(): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false)
  ready ??= (async () => {
    try {
      let perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
      if (perm.display !== 'granted') return false
      await LocalNotifications.createChannel({
        id: CHANNEL,
        name: 'Rest timer',
        description: 'Rings when a rest period ends',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#FF6B1A',
      })
      return true
    } catch {
      return false
    }
  })()
  return ready
}

/**
 * Schedule the "rest over" notification as a system alarm, so it rings with
 * sound and vibration even when the app is minimized or the screen is off.
 */
export async function scheduleRestAlarm(endsAt: number, label: string): Promise<void> {
  if (!(await initRestAlarm())) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_ID,
          title: 'Rest over',
          body: label ? `Next set: ${label}` : 'Next set',
          channelId: CHANNEL,
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          autoCancel: true,
        },
      ],
    })
  } catch {
    /* the in-app timer still shows */
  }
}

export async function cancelRestAlarm(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
  } catch {
    /* nothing scheduled */
  }
}
