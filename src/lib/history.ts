import { saveLocal } from './db'
import type { HistoryKind, HistoryRow } from './types'

export async function recordHistory(
  entityId: string,
  actionId: string | null,
  profileId: string | null,
  kind: HistoryKind,
  summary: string
): Promise<void> {
  if (!summary.trim()) return
  const now = new Date().toISOString()
  const row: HistoryRow = {
    id: crypto.randomUUID(),
    entity_id: entityId,
    action_id: actionId,
    profile_id: profileId,
    kind,
    summary,
    created_at: now,
    updated_at: now,
    deleted_at: null
  }
  await saveLocal('history', row)
}
