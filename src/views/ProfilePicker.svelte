<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { createProfile, setCurrentProfile } from '../lib/profiles'
  import type { ProfileRow } from '../lib/types'

  let profiles = $state<ProfileRow[]>([])
  let creating = $state(false)
  let name = $state('')
  let busy = $state(false)
  let error = $state('')

  $effect(() => {
    const sub = liveQuery(() => db.profiles.filter((p) => !p.deleted_at).toArray()).subscribe((rows) => {
      profiles = rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      if (rows.length === 0) creating = true
    })
    return () => sub.unsubscribe()
  })

  async function choose(profile: ProfileRow) {
    await setCurrentProfile(profile.id)
  }

  async function create(event: SubmitEvent) {
    event.preventDefault()
    if (busy) return
    if (!name.trim()) {
      error = 'Indiquez un nom.'
      return
    }
    busy = true
    error = ''
    try {
      await createProfile(name)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<div class="login-wrap">
  <div class="card login-card stack">
    <div class="logo" aria-hidden="true">👤</div>
    <h1>Qui es-tu ?</h1>
    <p class="muted">
      Le profil sert à savoir qui a fait quoi. Tous les profils voient les mêmes équipements,
      plantes et démarches.
    </p>

    {#if profiles.length > 0}
      <div class="profile-list">
        {#each profiles as profile (profile.id)}
          <button class="profile-option" onclick={() => choose(profile)}>
            <span class="avatar">{profile.name.slice(0, 1).toUpperCase()}</span>
            <span>{profile.name}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if creating}
      <form class="stack" onsubmit={create}>
        <label class="field">
          <span>Nouveau profil</span>
          <input type="text" bind:value={name} placeholder="Prénom" autocomplete="given-name" required />
        </label>
        {#if error}<p class="error">{error}</p>{/if}
        <button class="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Création…' : 'Créer et continuer'}
        </button>
        {#if profiles.length > 0}
          <button type="button" class="btn btn-ghost" onclick={() => (creating = false)}>Annuler</button>
        {/if}
      </form>
    {:else}
      <button class="btn" onclick={() => (creating = true)}>+ Nouveau profil</button>
    {/if}
  </div>
</div>
