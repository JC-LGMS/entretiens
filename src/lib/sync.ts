import { db, tableFor, CONFLICT_TARGET } from './db'
import { uploadPendingAttachments } from './attachments'
import { uploadPendingPhotos } from './photos'
import { app } from './state.svelte'
import { supabase } from './supabase'
import type { ConflictRow, OutboxRow, SyncTable } from './types'

const TABLES: SyncTable[] = [
  'profiles',
  'entities',
  'actions',
  'action_templates',
  'action_mutes',
  'logs',
  'history',
  'attachments',
  'profile_mutes'
]
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
  let attachmentError = ''
  try {
    try {
      await uploadPendingPhotos()
      await uploadPendingAttachments()
    } catch (error) {
      attachmentError = error instanceof Error ? error.message : String(error)
    }

    const pending = new Map(
      (await db.outbox.toArray()).map((row) => [`${row.table}:${row.row_id}`, row])
    )
    for (const table of TABLES) await pullTable(table, pending)
    app.conflicts = await db.conflicts.count()
    await flushOutbox()

    app.lastSync = new Date().toISOString()
    if (app.conflicts > 0) {
      app.sync = 'error'
      app.syncError = `${app.conflicts} conflit${app.conflicts > 1 ? 's' : ''} de synchronisation à résoudre`
    } else if (attachmentError) {
      app.sync = 'error'
      app.syncError = attachmentError
    } else {
      app.sync = 'idle'
    }
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
  const conflicts = new Set((await db.conflicts.toArray()).map((row) => `${row.table}:${row.row_id}`))
  const rows = await db.outbox.toArray()
  const order = new Map(TABLES.map((table, index) => [table, index]))
  rows.sort(
    (a, b) => (order.get(a.table)! - order.get(b.table)!) || (a.seq ?? 0) - (b.seq ?? 0)
  )
  for (const row of rows) {
    if (conflicts.has(`${row.table}:${row.row_id}`)) continue
    const { error } = await (supabase.from(row.table) as any).upsert(row.payload, {
      onConflict: CONFLICT_TARGET[row.table]
    })
    if (error) throw new Error(`${row.table} : ${error.message}`)
    if (row.seq !== undefined) await db.outbox.delete(row.seq)
  }
}

function rowIdFor(table: SyncTable, row: Record<string, any>): string {
  if (table === 'profile_mutes') return `${row.profile_id}:${row.entity_id}`
  if (table === 'action_mutes') return `${row.profile_id}:${row.action_id}`
  return String(row.id)
}

async function getLocalRow(table: SyncTable, row: Record<string, any>): Promise<any> {
  const target = tableFor(table)
  if (table === 'profile_mutes') return target.get([row.profile_id, row.entity_id])
  if (table === 'action_mutes') return target.get([row.profile_id, row.action_id])
  return target.get(row.id)
}

function samePayload(a: Record<string, any>, b: Record<string, any>): boolean {
  const strip = (value: Record<string, any>) => {
    const { updated_at, ...rest } = value
    return JSON.stringify(rest)
  }
  return strip(a) === strip(b)
}

async function recordConflict(
  table: SyncTable,
  rowId: string,
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): Promise<void> {
  const existing = await db.conflicts.where('[table+row_id]').equals([table, rowId]).first()
  if (existing) {
    await db.conflicts.put({
      ...existing,
      local_payload: local,
      remote_payload: remote,
      created_at: new Date().toISOString()
    })
  } else {
    await db.conflicts.add({
      id: crypto.randomUUID(),
      table,
      row_id: rowId,
      local_payload: local,
      remote_payload: remote,
      created_at: new Date().toISOString()
    })
  }
}

async function pullTable(table: SyncTable, pending: Map<string, OutboxRow>): Promise<void> {
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
      const rowId = rowIdFor(table, row)
      const outbox = pending.get(`${table}:${rowId}`)
      if (outbox) {
        const local = await getLocalRow(table, row)
        if (
          local &&
          outbox.base_updated_at &&
          row.updated_at > outbox.base_updated_at &&
          !samePayload(local, row)
        ) {
          await recordConflict(table, rowId, local, row)
        }
      } else {
        await target.put(row)
      }
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

export async function resolveConflictLocal(conflict: ConflictRow): Promise<void> {
  const outbox = await db.outbox
    .where('[table+row_id]')
    .equals([conflict.table, conflict.row_id])
    .first()
  const remoteUpdatedAt = String(conflict.remote_payload.updated_at ?? '')
  if (outbox?.seq !== undefined && remoteUpdatedAt) {
    await db.outbox.update(outbox.seq, { base_updated_at: remoteUpdatedAt })
  }
  await db.conflicts.delete(conflict.id)
  app.conflicts = await db.conflicts.count()
  void syncNow()
}

export async function resolveConflictRemote(conflict: ConflictRow): Promise<void> {
  const outbox = await db.outbox
    .where('[table+row_id]')
    .equals([conflict.table, conflict.row_id])
    .first()
  if (outbox?.seq !== undefined) await db.outbox.delete(outbox.seq)
  await tableFor(conflict.table).put(conflict.remote_payload)
  await db.conflicts.delete(conflict.id)
  app.conflicts = await db.conflicts.count()
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
