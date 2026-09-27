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

const REMINDER_CHANNEL = 'reminders'
let remindersReady: Promise<boolean> | null = null

async function initReminders(): Promise<boolean> {
  if (!isNative()) return false
  remindersReady ??= (async () => {
    try {
      let perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
      if (perm.display !== 'granted') return false
      await LocalNotifications.createChannel({ id: REMINDER_CHANNEL, name: 'Reminders', description: 'Workout and weigh-in reminders', importance: 4, visibility: 1, vibration: true })
      return true
    } catch {
      return false
    }
  })()
  return remindersReady
}

/**
 * Replace every scheduled reminder (ids in `range`) with `list`. Returns false
 * when notifications are not allowed or this is not the Android app.
 */
export async function syncReminders(list: { id: number; at: Date; title: string; body: string }[], range: readonly [number, number]): Promise<boolean> {
  if (!isNative()) return false
  if (list.length === 0) {
    // Nothing to schedule: clear old ones without asking for permission.
    try {
      const pending = await LocalNotifications.getPending()
      const old = pending.notifications.filter((n) => n.id >= range[0] && n.id <= range[1])
      if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) })
    } catch {
      /* nothing scheduled */
    }
    return true
  }
  if (!(await initReminders())) return false
  try {
    const pending = await LocalNotifications.getPending()
    const old = pending.notifications.filter((n) => n.id >= range[0] && n.id <= range[1])
    if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) })
    await LocalNotifications.schedule({
      notifications: list.map((r) => ({ id: r.id, title: r.title, body: r.body, channelId: REMINDER_CHANNEL, schedule: { at: r.at, allowWhileIdle: true }, autoCancel: true })),
    })
    return true
  } catch {
    return false
  }
}

const PARTNER_CHANNEL = 'partner'
let partnerReady: Promise<boolean> | null = null
let partnerNotifyId = 8000

/** Android: show a partner high-five, nudge or "ate this" right away. Does nothing on the web. */
export async function notifyPartner(title: string, body: string): Promise<void> {
  if (!isNative()) return
  partnerReady ??= (async () => {
    try {
      let perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
      if (perm.display !== 'granted') return false
      await LocalNotifications.createChannel({ id: PARTNER_CHANNEL, name: 'Partner', description: 'High-fives, nudges and shared meals from your partner', importance: 3, visibility: 1, vibration: true })
      return true
    } catch {
      return false
    }
  })()
  if (!(await partnerReady)) return
  try {
    // Ids 8000-8999 are partner notifications (reminders use 5000-7999, the rest timer 4201).
    partnerNotifyId = partnerNotifyId >= 8999 ? 8000 : partnerNotifyId + 1
    await LocalNotifications.schedule({ notifications: [{ id: partnerNotifyId, title, body, channelId: PARTNER_CHANNEL, autoCancel: true }] })
  } catch {
    /* in-app only */
  }
}
