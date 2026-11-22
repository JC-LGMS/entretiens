import { supabase, vapidPublicKey } from './supabase'
import type { PushSubscriptionRow } from './types'

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return null
  await navigator.serviceWorker.ready
  return registration
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await activeRegistration()
  if (!registration) return 'unsubscribed'
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'unsubscribed'
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Notifications non supportées sur cet appareil')
  if (!vapidPublicKey) throw new Error('Clé VAPID publique manquante')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permission refusée')
  const registration = await activeRegistration()
  if (!registration) {
    throw new Error("Service worker indisponible. Lancez l'application depuis un build de production.")
  }
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource
    }))
  await saveSubscription(subscription)
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const registration = await activeRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  if (supabase) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  }
  await subscription.unsubscribe()
}

export async function syncExistingSubscription(): Promise<void> {
  if (!pushSupported() || !supabase || !navigator.onLine) return
  const registration = await activeRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await saveSubscription(subscription)
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Abonnement push incomplet')
  }
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      label: deviceLabel(),
      last_seen: new Date().toISOString()
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw new Error(`Abonnement push : ${error.message}`)
}

export function deviceLabel(): string {
  const ua = navigator.userAgent
  const platform =
    (navigator as any).userAgentData?.platform ?? navigator.platform ?? 'Appareil'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navigateur'
  return `${platform} · ${browser}`
}

export async function listPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .order('last_seen', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PushSubscriptionRow[]
}

export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null
  const registration = await activeRegistration()
  if (!registration) return null
  const subscription = await registration.pushManager.getSubscription()
  return subscription?.endpoint ?? null
}

export async function revokePushSubscription(endpoint: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw new Error(error.message)
}

export async function sendTestPush(endpoint: string | null): Promise<number> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { data, error } = await supabase.functions.invoke('send-reminders', {
    body: { test: true, endpoint }
  })
  if (error) throw new Error(`Test de notification : ${error.message}`)
  const sent = (data as { sent?: number } | null)?.sent ?? 0
  if (sent === 0) {
    throw new Error('Aucune notification délivrée. Vérifiez l’abonnement de cet appareil.')
  }
  return sent
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}
