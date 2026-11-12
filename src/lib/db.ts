import Dexie, { type Table } from 'dexie'
import type {
  ActionRow,
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
  photos!: Table<PhotoRow, string>
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
  }
}

export const db = new AppDB()

const dexieNames: Record<SyncTable, keyof AppDB> = {
  profiles: 'profiles',
  entities: 'entities',
  actions: 'actions',
  logs: 'logs',
  history: 'history',
  profile_mutes: 'profileMutes'
}

export const CONFLICT_TARGET: Record<SyncTable, string> = {
  profiles: 'id',
  entities: 'id',
  actions: 'id',
  logs: 'id',
  history: 'id',
  profile_mutes: 'profile_id,entity_id'
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
  payload: Record<string, unknown>
): Promise<void> {
  const existing = await db.outbox.where('[table+row_id]').equals([table, rowId]).first()
  if (existing?.seq !== undefined) {
    await db.outbox.put({ ...existing, payload, created_at: new Date().toISOString() })
  } else {
    await db.outbox.add({ table, row_id: rowId, payload, created_at: new Date().toISOString() })
  }
}

function notifyLocalChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('entretiens:changed'))
}

export async function saveLocal<T extends { id: string }>(table: SyncTable, row: T): Promise<void> {
  const dexieTable = tableFor(table)
  const plain = toPlain(row)
  await db.transaction('rw', dexieTable, db.outbox, async () => {
    await dexieTable.put(plain)
    await queueOutbox(table, plain.id, plain as unknown as Record<string, unknown>)
  })
  notifyLocalChange()
}

export async function saveMute(row: ProfileMuteRow): Promise<void> {
  const plain = toPlain(row)
  await db.transaction('rw', db.profileMutes, db.outbox, async () => {
    await db.profileMutes.put(plain)
    await queueOutbox('profile_mutes', `${plain.profile_id}:${plain.entity_id}`, plain as unknown as Record<string, unknown>)
  })
  notifyLocalChange()
}

export async function softDelete(table: SyncTable, id: string): Promise<void> {
  const dexieTable = tableFor(table)
  const row = await dexieTable.get(id)
  if (!row) return
  await saveLocal(table, { ...row, deleted_at: new Date().toISOString() })
}
