import { supabase } from './supabase'
import { db, saveLocal } from './db'
import { compressImage } from './photos'
import type { AttachmentOwner, AttachmentRow } from './types'

const BUCKET = 'attachments'

export async function saveAttachment(
  ownerType: AttachmentOwner,
  ownerId: string,
  file: File,
  title: string
): Promise<AttachmentRow> {
  const id = crypto.randomUUID()
  const isImage = file.type.startsWith('image/')
  const blob = isImage ? await compressImage(file, 1600, 0.82) : file
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'fichier'
  const storagePath = `${id}-${cleanName}`
  const now = new Date().toISOString()
  await db.attachmentBlobs.put({ id, blob, uploaded: 0, updated_at: now })
  const row: AttachmentRow = {
    id,
    owner_type: ownerType,
    owner_id: ownerId,
    title: title.trim() || file.name,
    storage_path: storagePath,
    mime_type: isImage ? 'image/jpeg' : file.type || 'application/octet-stream',
    updated_at: now,
    deleted_at: null
  }
  await saveLocal('attachments', row)
  return row
}

export async function getAttachmentBlob(row: AttachmentRow): Promise<Blob | null> {
  const local = await db.attachmentBlobs.get(row.id)
  if (local) return local.blob
  if (!supabase || !navigator.onLine) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(row.storage_path)
  if (error || !data) return null
  await db.attachmentBlobs.put({
    id: row.id,
    blob: data,
    uploaded: 1,
    updated_at: new Date().toISOString()
  })
  return data
}

export async function uploadPendingAttachments(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const pending = await db.attachmentBlobs.where('uploaded').equals(0).toArray()
  for (const item of pending) {
    const row = await db.attachments.get(item.id)
    if (!row) continue
    const { error } = await supabase.storage.from(BUCKET).upload(row.storage_path, item.blob, {
      upsert: true,
      contentType: row.mime_type
    })
    if (error) throw new Error(`Pièce jointe : ${error.message}`)
    await db.attachmentBlobs.update(item.id, { uploaded: 1 })
  }
}

export async function deleteAttachment(row: AttachmentRow): Promise<void> {
  await db.attachmentBlobs.delete(row.id)
  await saveLocal('attachments', { ...row, deleted_at: new Date().toISOString() })
  if (supabase && navigator.onLine) {
    await supabase.storage.from(BUCKET).remove([row.storage_path])
  }
}
