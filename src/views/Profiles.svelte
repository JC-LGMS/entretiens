<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { app } from '../lib/state.svelte'
  import type { ProfileRow } from '../lib/types'

  let profiles = $state<ProfileRow[]>([])
  let counts = $state<Record<string, { logs: number; history: number }>>({})

  $effect(() => {
    const sub = liveQuery(async () => {
      const rows = (await db.profiles.toArray())
        .filter((profile) => !profile.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      const logs = (await db.logs.toArray()).filter((log) => !log.deleted_at)
      const history = (await db.history.toArray()).filter((row) => !row.deleted_at)
      const nextCounts: Record<string, { logs: number; history: number }> = {}
      for (const profile of rows) nextCounts[profile.id] = { logs: 0, history: 0 }
      for (const log of logs) {
        if (log.created_by && nextCounts[log.created_by]) nextCounts[log.created_by].logs += 1
      }
      for (const row of history) {
        if (row.profile_id && nextCounts[row.profile_id]) nextCounts[row.profile_id].history += 1
      }
      return { profiles: rows, counts: nextCounts }
    }).subscribe((value) => {
      profiles = value.profiles
      counts = value.counts
    })
    return () => sub.unsubscribe()
  })
</script>

<a href="#/settings" class="btn btn-ghost btn-sm" style="margin-bottom:10px">← Réglages</a>

<h1>Comptes</h1>
<p class="muted tiny" style="margin-bottom:14px">
  Tous les profils partagent les mêmes données. L'historique indique ce que chacun a fait.
</p>

{#if profiles.length === 0}
  <div class="card empty">
    <p>Aucun profil.</p>
  </div>
{:else}
  <div class="card">
    {#each profiles as profile (profile.id)}
      <a class="entity-row" href={`#/profile/${profile.id}`}>
        <span class="avatar">{profile.name.slice(0, 1).toUpperCase()}</span>
        <div class="entity-main">
          <strong>
            {profile.name}
            {#if app.profileId === profile.id}<span class="badge neutral" style="margin-left:6px">Vous</span>{/if}
          </strong>
          <small>
            {counts[profile.id]?.logs ?? 0} réalisation{(counts[profile.id]?.logs ?? 0) > 1 ? 's' : ''}
            · {counts[profile.id]?.history ?? 0} modification{(counts[profile.id]?.history ?? 0) > 1 ? 's' : ''}
          </small>
        </div>
        <span class="muted" aria-hidden="true">›</span>
      </a>
    {/each}
  </div>
{/if}
