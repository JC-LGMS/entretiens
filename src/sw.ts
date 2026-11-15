/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { db } from './lib/db'
import { shouldShowNotification } from './lib/notify'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('install', () => {
  // Le rechargement est laissé au bouton « Mettre à jour ».
})

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

interface PushPayload {
  title?: string
  body?: string
  entityId?: string
  actionId?: string | null
  url?: string
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      if (!event.data) return
      let data: PushPayload
      try {
        data = event.data.json() as PushPayload
      } catch {
        return
      }

      const profileId = (await db.settings.get('currentProfileId'))?.value ?? null
      let muted = false
      if (profileId && data.entityId) {
        const mute = await db.profileMutes
          .where('[profile_id+entity_id]')
          .equals([profileId, data.entityId])
          .first()
        muted = Boolean(mute?.muted && !mute.deleted_at)
      }
      if (profileId && data.actionId && !muted) {
        const mute = await db.actionMutes
          .where('[profile_id+action_id]')
          .equals([profileId, data.actionId])
          .first()
        muted = Boolean(mute?.muted && !mute.deleted_at)
      }
      if (!shouldShowNotification(profileId, muted)) return

      await self.registration.showNotification(data.title ?? 'Entretien à prévoir', {
        body: data.body ?? '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url ?? '/#/planning' }
      })
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = String((event.notification.data as { url?: string } | undefined)?.url ?? '/#/planning')
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('navigate' in client) {
          await (client as WindowClient).navigate(url)
          await (client as WindowClient).focus()
          return
        }
      }
      await self.clients.openWindow(url)
    })()
  )
})
