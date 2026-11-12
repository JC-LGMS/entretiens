import { db, saveLocal } from './db'
import { app } from './state.svelte'
import type { ProfileRow } from './types'

export async function loadCurrentProfile(): Promise<void> {
  const setting = await db.settings.get('currentProfileId')
  const id = setting?.value ?? null
  if (!id) {
    app.profileId = null
    app.profile = null
    return
  }
  const profile = await db.profiles.get(id)
  if (!profile || profile.deleted_at) {
    app.profileId = null
    app.profile = null
    return
  }
  app.profileId = profile.id
  app.profile = profile
}

export async function setCurrentProfile(id: string | null): Promise<void> {
  if (!id) {
    await db.settings.delete('currentProfileId')
    app.profileId = null
    app.profile = null
    return
  }
  await db.settings.put({ key: 'currentProfileId', value: id })
  await loadCurrentProfile()
}

export async function createProfile(name: string): Promise<ProfileRow> {
  const now = new Date().toISOString()
  const profile: ProfileRow = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Moi',
    updated_at: now,
    deleted_at: null
  }
  await saveLocal('profiles', profile)
  await setCurrentProfile(profile.id)
  return profile
}
