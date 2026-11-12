<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import type { ProfileRow } from '../lib/types'

  let { id }: { id: string } = $props()

  interface Entry {
    id: string
    at: string
    title: string
    subtitle: string
    comment: string
  }

  let data = $state<{ profile: ProfileRow | null; entries: Entry[] }>({
    profile: null,
    entries: []
  })

  $effect(() => {
    const profileId = id
    const sub = liveQuery(async () => {
      const profile = (await db.profiles.get(profileId)) ?? null
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
      return { profile, entries: entries.slice(0, 150) }
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
</script>

<a href="#/profiles" class="btn btn-ghost btn-sm" style="margin-bottom:10px">← Comptes</a>

{#if !data.profile}
  <div class="card empty">
    <span class="big" aria-hidden="true">👤</span>
    <p>Ce profil n'existe pas.</p>
  </div>
{:else}
  <div class="card card-pad">
    <div class="row">
      <span class="avatar">{data.profile.name.slice(0, 1).toUpperCase()}</span>
      <div class="entity-main">
        <h1>{data.profile.name}</h1>
        <p class="muted tiny">{data.entries.length} événement{data.entries.length > 1 ? 's' : ''}</p>
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
