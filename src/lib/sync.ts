import { db, tableFor, CONFLICT_TARGET } from './db'
import { uploadPendingPhotos } from './photos'
import { app } from './state.svelte'
import { supabase } from './supabase'
import type { SyncTable } from './types'

const TABLES: SyncTable[] = ['profiles', 'entities', 'actions', 'logs', 'history', 'profile_mutes']
const PAGE = 500
let running = false
let queued = false
let timer: number | undefined

export function requestSync(delay = 700): void {
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = undefined
    void syncNow()
  }, delay)
}

export async function syncNow(): Promise<void> {
  if (!supabase || !app.session) return
  if (running) {
    queued = true
    return
  }
  if (!navigator.onLine) {
    app.sync = 'offline'
    return
  }
  running = true
  app.sync = 'syncing'
  app.syncError = ''
  let photoError = ''
  try {
    try {
      await uploadPendingPhotos()
    } catch (error) {
      photoError = error instanceof Error ? error.message : String(error)
    }
    await flushOutbox()
    const pending = new Set((await db.outbox.toArray()).map((o) => `${o.table}:${o.row_id}`))
    for (const table of TABLES) {
      await pullTable(table, pending)
    }
    app.lastSync = new Date().toISOString()
    app.sync = photoError ? 'error' : 'idle'
    app.syncError = photoError
  } catch (error) {
    app.sync = 'error'
    app.syncError = error instanceof Error ? error.message : String(error)
  } finally {
    running = false
    if (queued) {
      queued = false
      void syncNow()
    }
  }
}

async function flushOutbox(): Promise<void> {
  if (!supabase) return
  const rows = await db.outbox.toArray()
  const order = new Map(TABLES.map((t, i) => [t, i]))
  rows.sort((a, b) => (order.get(a.table)! - order.get(b.table)!) || (a.seq ?? 0) - (b.seq ?? 0))
  for (const row of rows) {
    const { error } = await (supabase.from(row.table) as any).upsert(row.payload, {
      onConflict: CONFLICT_TARGET[row.table]
    })
    if (error) throw new Error(`${row.table} : ${error.message}`)
    if (row.seq !== undefined) await db.outbox.delete(row.seq)
  }
}

async function pullTable(table: SyncTable, pending: Set<string>): Promise<void> {
  if (!supabase) return
  const cursorKey = `cursor:${table}`
  let cursor = (await db.settings.get(cursorKey))?.value ?? '1970-01-01T00:00:00.000Z'
  const target = tableFor(table)

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(`${table} : ${error.message}`)
    if (!data || data.length === 0) break

    let max = cursor
    for (const row of data) {
      const rowId =
        table === 'profile_mutes' ? `${row.profile_id}:${row.entity_id}` : String(row.id)
      if (!pending.has(`${table}:${rowId}`)) await target.put(row)
      if (row.updated_at > max) max = row.updated_at
    }
    const advanced = max !== cursor
    if (advanced) {
      cursor = max
      await db.settings.put({ key: cursorKey, value: cursor })
    }
    if (data.length < PAGE || !advanced) break
  }
}

export function startSync(): () => void {
  const onOnline = () => void syncNow()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  const onLocalChange = () => requestSync()
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('entretiens:changed', onLocalChange)
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('entretiens:changed', onLocalChange)
    window.clearInterval(interval)
  }
}
