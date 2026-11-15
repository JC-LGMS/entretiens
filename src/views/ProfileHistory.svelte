<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { mergeProfiles, renameProfile } from '../lib/profiles'
  import { navigate } from '../lib/router.svelte'
  import type { ProfileRow } from '../lib/types'
  import Modal from '../components/Modal.svelte'

  let { id }: { id: string } = $props()

  interface Entry {
    id: string
    at: string
    title: string
    subtitle: string
    comment: string
  }

  let data = $state<{ profile: ProfileRow | null; entries: Entry[]; profiles: ProfileRow[] }>({
    profile: null,
    entries: [],
    profiles: []
  })
  let showRename = $state(false)
  let showMerge = $state(false)
  let name = $state('')
  let target = $state('')
  let busy = $state(false)
  let error = $state('')

  $effect(() => {
    const profileId = id
    const sub = liveQuery(async () => {
      const profile = (await db.profiles.get(profileId)) ?? null
      const profiles = (await db.profiles.toArray()).filter((row) => !row.deleted_at && row.id !== profileId)
      const logs = (await db.logs.toArray()).filter(
        (log) => log.created_by === profileId && !log.deleted_at
      )
      const history = (await db.history.toArray()).filter(
        (row) => row.profile_id === profileId && !row.deleted_at
      )
      const actions = new Map((await db.actions.toArray()).map((action) => [action.id, action]))
      const entities = new Map((await db.entities.toArray()).map((entity) => [entity.id, entity]))
      const entries: Entry[] = []

      for (const log of logs) {
        const action = actions.get(log.action_id)
        const entity = action ? entities.get(action.entity_id) : undefined
        entries.push({
          id: log.id,
          at: new Date(`${log.done_on}T12:00:00`).toISOString(),
          title: `Action « ${action?.label ?? 'supprimée'} » faite`,
          subtitle: entity?.name ?? '',
          comment: log.comment
        })
      }
      for (const row of history) {
        entries.push({
          id: row.id,
          at: row.created_at,
          title: row.summary,
          subtitle: entities.get(row.entity_id)?.name ?? '',
          comment: ''
        })
      }

      entries.sort((a, b) => b.at.localeCompare(a.at))
      return { profile, profiles, entries: entries.slice(0, 150) }
    }).subscribe((value) => {
      data = value
    })
    return () => sub.unsubscribe()
  })

  function when(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  async function submitRename(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = ''
    try {
      await renameProfile(id, name)
      showRename = false
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  async function submitMerge(event: SubmitEvent) {
    event.preventDefault()
    if (!target) return
    if (!confirm('Fusionner ce profil dans le profil choisi ? Les historiques seront réaffectés.')) return
    busy = true
    error = ''
    try {
      await mergeProfiles(id, target)
      navigate('/profiles')
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<a href="#/profiles" class="btn btn-ghost btn-sm" style="margin-bottom:10px">← Comptes</a>

{#if !data.profile || data.profile.deleted_at}
  <div class="card empty">
    <span class="big" aria-hidden="true">👤</span>
    <p>Ce profil n'existe pas.</p>
  </div>
{:else}
  <div class="card card-pad">
    <div class="row between wrap">
      <div class="row">
        <span class="avatar">{data.profile.name.slice(0, 1).toUpperCase()}</span>
        <div class="entity-main">
          <h1>{data.profile.name}</h1>
          <p class="muted tiny">{data.entries.length} événement{data.entries.length > 1 ? 's' : ''}</p>
        </div>
      </div>
      <div class="row wrap">
        <button class="btn btn-sm" onclick={() => { name = data.profile?.name ?? ''; showRename = true }}>
          Renommer
        </button>
        <button class="btn btn-sm" onclick={() => (showMerge = true)}>Fusionner</button>
      </div>
    </div>
  </div>

  <div class="section-title"><h2>Historique</h2></div>

  {#if data.entries.length === 0}
    <div class="card empty"><p>Aucune activité pour ce profil.</p></div>
  {:else}
    <div class="card card-pad">
      <div class="timeline">
        {#each data.entries as entry (entry.id)}
          <div class="timeline-item">
            <div class="when">{when(entry.at)}{entry.subtitle ? ` · ${entry.subtitle}` : ''}</div>
            <p>{entry.title}</p>
            {#if entry.comment}<p class="muted">{entry.comment}</p>{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}

{#if showRename}
  <Modal title="Renommer le profil" onclose={() => (showRename = false)}>
    <form onsubmit={submitRename}>
      <label class="field">
        <span>Nom</span>
        <input type="text" bind:value={name} required />
      </label>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if showMerge}
  <Modal title="Fusionner le profil" onclose={() => (showMerge = false)}>
    <form onsubmit={submitMerge}>
      <p class="muted" style="margin-bottom:10px">
        Les réalisations, modifications, assignations et préférences de ce profil seront réaffectées.
      </p>
      <label class="field">
        <span>Fusionner dans</span>
        <select bind:value={target} required>
          <option value="">Choisir un profil</option>
          {#each data.profiles as profile (profile.id)}
            <option value={profile.id}>{profile.name}</option>
          {/each}
        </select>
      </label>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit" disabled={busy || !target}>
          {busy ? 'Fusion…' : 'Fusionner'}
        </button>
      </div>
    </form>
  </Modal>
{/if}
