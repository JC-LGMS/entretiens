import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db, saveActionMute, saveLocal, saveMute } from './db'
import { getAttachmentBlob } from './attachments'
import { getPhotoBlob } from './photos'
import { APP_VERSION } from './version'
import type {
  ActionMuteRow,
  ActionRow,
  ActionTemplateRow,
  AttachmentRow,
  EntityRow,
  HistoryRow,
  LogRow,
  ProfileMuteRow,
  ProfileRow
} from './types'

interface BackupData {
  version: string
  exported_at: string
  profiles: ProfileRow[]
  entities: EntityRow[]
  actions: ActionRow[]
  action_templates: ActionTemplateRow[]
  logs: LogRow[]
  history: HistoryRow[]
  profile_mutes: ProfileMuteRow[]
  action_mutes: ActionMuteRow[]
  attachments: AttachmentRow[]
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

const LAST_EXPORT_KEY = 'backup.lastExport'
export const BACKUP_REMINDER_DAYS = 90

export function lastExportAt(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(LAST_EXPORT_KEY)
}

export function backupAgeDays(): number | null {
  const value = lastExportAt()
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
}

export async function exportBackup(): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  const profiles = await db.profiles.toArray()
  const entities = await db.entities.toArray()
  const actions = await db.actions.toArray()
  const actionTemplates = await db.actionTemplates.toArray()
  const logs = await db.logs.toArray()
  const history = await db.history.toArray()
  const profileMutes = await db.profileMutes.toArray()
  const actionMutes = await db.actionMutes.toArray()
  const attachments = await db.attachments.toArray()

  const data: BackupData = {
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    profiles,
    entities,
    actions,
    action_templates: actionTemplates,
    logs,
    history,
    profile_mutes: profileMutes,
    action_mutes: actionMutes,
    attachments
  }
  files['data.json'] = strToU8(JSON.stringify(data, null, 2))

  for (const entity of entities) {
    if (!entity.photo_path) continue
    const blob = await getPhotoBlob(entity.id, entity.photo_path)
    if (blob) files[`photos/${entity.photo_path}`] = await blobBytes(blob)
  }

  for (const attachment of attachments) {
    if (attachment.deleted_at) continue
    const blob = await getAttachmentBlob(attachment)
    if (blob) files[`attachments/${attachment.storage_path}`] = await blobBytes(blob)
  }

  const zip = zipSync(files)
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `entretiens-export-${new Date().toISOString().slice(0, 10)}.zip`
  link.click()
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function importBackup(file: File): Promise<void> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const raw = entries['data.json']
  if (!raw) throw new Error('Archive invalide : data.json manquant.')
  const data = JSON.parse(strFromU8(raw)) as BackupData
  if (!Array.isArray(data.profiles) || !Array.isArray(data.entities)) {
    throw new Error('Archive invalide : données incomplètes.')
  }

  for (const row of data.profiles ?? []) await saveLocal('profiles', row)
  for (const row of data.entities ?? []) await saveLocal('entities', row)
  for (const row of data.actions ?? []) await saveLocal('actions', row)
  for (const row of data.action_templates ?? []) await saveLocal('action_templates', row)
  for (const row of data.logs ?? []) await saveLocal('logs', row)
  for (const row of data.history ?? []) await saveLocal('history', row)
  for (const row of data.attachments ?? []) await saveLocal('attachments', row)
  for (const row of data.profile_mutes ?? []) await saveMute(row)
  for (const row of data.action_mutes ?? []) await saveActionMute(row)

  const entities = new Map((data.entities ?? []).map((entity) => [entity.id, entity]))
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith('photos/')) {
      const photoPath = path.slice('photos/'.length)
      const entity = [...entities.values()].find((row) => row.photo_path === photoPath)
      if (!entity) continue
      await db.photos.put({
        entityId: entity.id,
        path: photoPath,
        blob: new Blob([bytes], { type: 'image/jpeg' }),
        uploaded: 0,
        updated_at: new Date().toISOString()
      })
    } else if (path.startsWith('attachments/')) {
      const storagePath = path.slice('attachments/'.length)
      const attachment = (data.attachments ?? []).find((row) => row.storage_path === storagePath)
      if (!attachment) continue
      await db.attachmentBlobs.put({
        id: attachment.id,
        blob: new Blob([bytes], { type: attachment.mime_type || 'application/octet-stream' }),
        uploaded: 0,
        updated_at: new Date().toISOString()
      })
    }
  }
}
