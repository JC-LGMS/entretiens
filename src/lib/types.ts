export type Kind = 'equipement' | 'plante' | 'administratif'
export type IntervalUnit = 'day' | 'week' | 'month' | 'year'

export const KINDS: { value: Kind; label: string; emoji: string }[] = [
  { value: 'equipement', label: 'Équipement', emoji: '🔧' },
  { value: 'plante', label: 'Plante', emoji: '🌿' },
  { value: 'administratif', label: 'Administratif', emoji: '📄' }
]

export const UNITS: { value: IntervalUnit; label: string }[] = [
  { value: 'day', label: 'jour(s)' },
  { value: 'week', label: 'semaine(s)' },
  { value: 'month', label: 'mois' },
  { value: 'year', label: 'an(s)' }
]

export interface ProfileRow {
  id: string
  name: string
  updated_at: string
  deleted_at: string | null
}

export interface EntityRow {
  id: string
  kind: Kind
  name: string
  notes: string
  photo_path: string | null
  archived: boolean
  updated_at: string
  deleted_at: string | null
}

export interface ActionRow {
  id: string
  entity_id: string
  label: string
  interval_value: number
  interval_unit: IntervalUnit
  last_done: string | null
  next_due: string
  active: boolean
  archived: boolean
  annual_dates: string[]
  notified_for: string | null
  updated_at: string
  deleted_at: string | null
}

export interface LogRow {
  id: string
  action_id: string
  done_on: string
  comment: string
  created_by: string | null
  updated_at: string
  deleted_at: string | null
}

export type HistoryKind =
  | 'entity_created'
  | 'entity_updated'
  | 'entity_deleted'
  | 'entity_archived'
  | 'entity_restored'
  | 'action_created'
  | 'action_updated'
  | 'action_deleted'
  | 'action_archived'
  | 'action_restored'
  | 'photo_updated'
  | 'due_changed'
  | 'notify_toggled'

export interface HistoryRow {
  id: string
  entity_id: string
  action_id: string | null
  profile_id: string | null
  kind: HistoryKind
  summary: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProfileMuteRow {
  profile_id: string
  entity_id: string
  muted: boolean
  updated_at: string
  deleted_at: string | null
}

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export interface SettingRow {
  key: string
  value: string
}

export type SyncTable =
  | 'profiles'
  | 'entities'
  | 'actions'
  | 'logs'
  | 'history'
  | 'profile_mutes'

export interface OutboxRow {
  seq?: number
  table: SyncTable
  row_id: string
  payload: Record<string, unknown>
  created_at: string
}

export interface PhotoRow {
  entityId: string
  path: string
  blob: Blob
  uploaded: 0 | 1
  updated_at: string
}
