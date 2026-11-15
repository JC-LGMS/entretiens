import { writable } from 'svelte/store'
import { registerSW } from 'virtual:pwa-register'

export const needRefresh = writable(false)
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null

export function registerPwa(): void {
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.set(true)
    }
  })
}

export async function applyPwaUpdate(): Promise<void> {
  await updateServiceWorker?.(true)
  needRefresh.set(false)
}
