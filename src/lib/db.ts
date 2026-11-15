import Dexie, { type Table } from 'dexie'
import type {
  ActionMuteRow,
  ActionRow,
  AttachmentBlobRow,
  AttachmentRow,
  ConflictRow,
  EntityRow,
  HistoryRow,
  LogRow,
  OutboxRow,
  PhotoRow,
  ProfileMuteRow,
  ProfileRow,
  SettingRow,
  SyncTable
} from './types'

class AppDB extends Dexie {
  settings!: Table<SettingRow, string>
  profiles!: Table<ProfileRow, string>
  entities!: Table<EntityRow, string>
  actions!: Table<ActionRow, string>
  logs!: Table<LogRow, string>
  history!: Table<HistoryRow, string>
  profileMutes!: Table<ProfileMuteRow, [string, string]>
  actionMutes!: Table<ActionMuteRow, [string, string]>
  attachments!: Table<AttachmentRow, string>
  attachmentBlobs!: Table<AttachmentBlobRow, string>
  photos!: Table<PhotoRow, string>
  conflicts!: Table<ConflictRow, string>
  outbox!: Table<OutboxRow, number>

  constructor() {
    super('entretiens')
    this.version(1).stores({
      settings: 'key',
      profiles: 'id, updated_at',
      entities: 'id, kind, updated_at',
      actions: 'id, entity_id, next_due, updated_at',
      logs: 'id, action_id, done_on, updated_at',
      history: 'id, entity_id, created_at, updated_at',
      profileMutes: '[profile_id+entity_id], profile_id, entity_id, updated_at',
      photos: 'entityId, uploaded',
      outbox: '++seq, &[table+row_id], table'
    })
    this.version(2).stores({
      actionMutes: '[profile_id+action_id], profile_id, action_id, updated_at',
      attachments: 'id, owner_type, owner_id, updated_at',
      attachmentBlobs: 'id, uploaded',
      conflicts: 'id, &[table+row_id], created_at'
    })
  }
}

export const db = new AppDB()

const dexieNames: Record<SyncTable, keyof AppDB> = {
  profiles: 'profiles',
  entities: 'entities',
  actions: 'actions',
  logs: 'logs',
  history: 'history',
  profile_mutes: 'profileMutes',
  action_mutes: 'actionMutes',
  attachments: 'attachments'
}

export const CONFLICT_TARGET: Record<SyncTable, string> = {
  profiles: 'id',
  entities: 'id',
  actions: 'id',
  logs: 'id',
  history: 'id',
  profile_mutes: 'profile_id,entity_id',
  action_mutes: 'profile_id,action_id',
  attachments: 'id'
}

export function tableFor(table: SyncTable): Table<any, any> {
  return (db as unknown as Record<string, Table<any, any>>)[dexieNames[table]]
}

function toPlain<T>(value: T): T {
  // Dexie ne peut pas cloner les proxys réactifs de Svelte ($state).
  return JSON.parse(JSON.stringify(value)) as T
}

export async function queueOutbox(
  table: SyncTable,
  rowId: string,
  payload: Record<string, unknown>,
  baseUpdatedAt: string | null
): Promise<void> {
  const existing = await db.outbox.where('[table+row_id]').equals([table, rowId]).first()
  if (existing?.seq !== undefined) {
    await db.outbox.put({
      ...existing,
      payload,
      base_updated_at: existing.base_updated_at ?? baseUpdatedAt,
      created_at: new Date().toISOString()
    })
  } else {
    await db.outbox.add({
      table,
      row_id: rowId,
      payload,
      base_updated_at: baseUpdatedAt,
      created_at: new Date().toISOString()
    })
  }
}

function notifyLocalChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('entretiens:changed'))
}

export async function saveLocal<T extends { id: string }>(table: SyncTable, row: T): Promise<void> {
  const dexieTable = tableFor(table)
  const existing = await dexieTable.get(row.id)
  const pending = await db.outbox.where('[table+row_id]').equals([table, row.id]).first()
  const base = pending?.base_updated_at ?? existing?.updated_at ?? null
  const plain = toPlain(row)
  await db.transaction('rw', dexieTable, db.outbox, async () => {
    await dexieTable.put(plain)
    await queueOutbox(table, plain.id, plain as unknown as Record<string, unknown>, base)
  })
  notifyLocalChange()
}

async function saveComposite<T>(
  table: SyncTable,
  dexieTable: Table<T, [string, string]>,
  row: T,
  rowId: string,
  key: [string, string]
): Promise<void> {
  const existing = await dexieTable.get(key)
  const pending = await db.outbox.where('[table+row_id]').equals([table, rowId]).first()
  const base =
    pending?.base_updated_at ??
    (existing as unknown as { updated_at?: string } | undefined)?.updated_at ??
    null
  const plain = toPlain(row)
  await db.transaction('rw', dexieTable, db.outbox, async () => {
    await dexieTable.put(plain)
    await queueOutbox(table, rowId, plain as unknown as Record<string, unknown>, base)
  })
  notifyLocalChange()
}

export async function saveMute(row: ProfileMuteRow): Promise<void> {
  await saveComposite(
    'profile_mutes',
    db.profileMutes,
    row,
    `${row.profile_id}:${row.entity_id}`,
    [row.profile_id, row.entity_id]
  )
}

export async function saveActionMute(row: ActionMuteRow): Promise<void> {
  await saveComposite(
    'action_mutes',
    db.actionMutes,
    row,
    `${row.profile_id}:${row.action_id}`,
    [row.profile_id, row.action_id]
  )
}

export async function softDelete(table: SyncTable, id: string): Promise<void> {
  const dexieTable = tableFor(table)
  const row = await dexieTable.get(id)
  if (!row) return
  await saveLocal(table, { ...row, deleted_at: new Date().toISOString() })
}
