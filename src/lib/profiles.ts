import { db, saveActionMute, saveLocal, saveMute } from './db'
import { cleanProfileName, normalizeProfileName } from './profile-name'
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
  const clean = cleanProfileName(name)
  if (!clean) throw new Error('Indiquez un nom.')
  const key = normalizeProfileName(clean)
  // shortcut: unicité vérifiée localement, deux créations hors ligne sur deux appareils peuvent se rejoindre ; ajouter une contrainte serveur + fusion si besoin.
  const existing = await db.profiles
    .filter((profile) => !profile.deleted_at && normalizeProfileName(profile.name) === key)
    .first()
  if (existing) throw new Error(`Le profil « ${existing.name} » existe déjà.`)

  const now = new Date().toISOString()
  const profile: ProfileRow = {
    id: crypto.randomUUID(),
    name: clean,
    updated_at: now,
    deleted_at: null
  }
  await saveLocal('profiles', profile)
  await setCurrentProfile(profile.id)
  return profile
}

export async function deleteProfile(id: string): Promise<void> {
  const profile = await db.profiles.get(id)
  if (!profile || profile.deleted_at) return
  const [logs, history] = await Promise.all([
    db.logs.filter((log) => log.created_by === id && !log.deleted_at).count(),
    db.history.filter((row) => row.profile_id === id && !row.deleted_at).count()
  ])
  if (logs + history > 0) {
    throw new Error("Ce profil a de l'activité et ne peut pas être supprimé.")
  }
  await saveLocal('profiles', { ...profile, deleted_at: new Date().toISOString() })
  if (app.profileId === id) await setCurrentProfile(null)
}

export async function renameProfile(id: string, name: string): Promise<void> {
  const profile = await db.profiles.get(id)
  if (!profile) throw new Error('Profil introuvable.')
  const clean = cleanProfileName(name)
  if (!clean) throw new Error('Indiquez un nom.')
  const key = normalizeProfileName(clean)
  const existing = await db.profiles
    .filter(
      (row) =>
        row.id !== id && !row.deleted_at && normalizeProfileName(row.name) === key
    )
    .first()
  if (existing) throw new Error(`Le profil « ${existing.name} » existe déjà.`)
  await saveLocal('profiles', { ...profile, name: clean, updated_at: new Date().toISOString() })
  if (app.profileId === id) await loadCurrentProfile()
}

export async function mergeProfiles(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new Error('Choisissez un autre profil.')
  const source = await db.profiles.get(sourceId)
  const target = await db.profiles.get(targetId)
  if (!source || !target) throw new Error('Profil introuvable.')
  const now = new Date().toISOString()

  const logs = await db.logs.filter((log) => log.created_by === sourceId).toArray()
  for (const log of logs) {
    await saveLocal('logs', { ...log, created_by: targetId, updated_at: now })
  }
  const history = await db.history.filter((row) => row.profile_id === sourceId).toArray()
  for (const row of history) {
    await saveLocal('history', { ...row, profile_id: targetId, updated_at: now })
  }
  const actions = await db.actions.filter((action) => action.assigned_profile_id === sourceId).toArray()
  for (const action of actions) {
    await saveLocal('actions', { ...action, assigned_profile_id: targetId, updated_at: now })
  }

  const entityMutes = await db.profileMutes.filter((row) => row.profile_id === sourceId).toArray()
  for (const mute of entityMutes) {
    const targetMute = await db.profileMutes.get([targetId, mute.entity_id])
    await saveMute({
      profile_id: targetId,
      entity_id: mute.entity_id,
      muted: mute.muted || targetMute?.muted || false,
      updated_at: now,
      deleted_at: null
    })
    await saveMute({ ...mute, deleted_at: now })
  }

  const actionMutes = await db.actionMutes.filter((row) => row.profile_id === sourceId).toArray()
  for (const mute of actionMutes) {
    const targetMute = await db.actionMutes.get([targetId, mute.action_id])
    await saveActionMute({
      profile_id: targetId,
      action_id: mute.action_id,
      muted: mute.muted || targetMute?.muted || false,
      updated_at: now,
      deleted_at: null
    })
    await saveActionMute({ ...mute, deleted_at: now })
  }

  await saveLocal('profiles', { ...source, deleted_at: now, updated_at: now })
  if (app.profileId === sourceId) await setCurrentProfile(targetId)
}
