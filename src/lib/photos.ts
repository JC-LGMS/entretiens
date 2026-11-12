import { supabase } from './supabase'
import { db, saveLocal } from './db'
import type { EntityRow } from './types'

const BUCKET = 'photos'

export async function compressImage(file: File, max = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de préparer la photo')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compression impossible'))), 'image/jpeg', quality)
  })
}

export async function setEntityPhoto(entity: EntityRow, file: File): Promise<EntityRow> {
  const blob = await compressImage(file)
  // Un nom versionné périme le cache des autres appareils quand la photo change.
  const path = `${entity.id}-${Date.now()}.jpg`
  await db.photos.put({
    entityId: entity.id,
    path,
    blob,
    uploaded: 0,
    updated_at: new Date().toISOString()
  })
  const updated: EntityRow = { ...entity, photo_path: path, updated_at: new Date().toISOString() }
  await saveLocal('entities', updated)
  return updated
}

export async function removeEntityPhoto(entity: EntityRow): Promise<EntityRow> {
  const oldPath = entity.photo_path
  await db.photos.delete(entity.id)
  const updated: EntityRow = { ...entity, photo_path: null, updated_at: new Date().toISOString() }
  await saveLocal('entities', updated)
  if (oldPath && supabase && navigator.onLine) {
    await supabase.storage.from(BUCKET).remove([oldPath])
  }
  return updated
}

export async function getPhotoBlob(entityId: string, photoPath: string | null): Promise<Blob | null> {
  if (!photoPath) return null
  const local = await db.photos.get(entityId)
  if (local && local.path === photoPath) return local.blob
  if (!supabase || !navigator.onLine) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(photoPath)
  if (error || !data) return null
  await db.photos.put({
    entityId,
    path: photoPath,
    blob: data,
    uploaded: 1,
    updated_at: new Date().toISOString()
  })
  return data
}

export async function uploadPendingPhotos(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const pending = await db.photos.where('uploaded').equals(0).toArray()
  for (const photo of pending) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(photo.path, photo.blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw new Error(`Photo : ${error.message}`)
    await db.photos.update(photo.entityId, { uploaded: 1 })
  }
}
