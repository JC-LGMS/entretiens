<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { app } from '../lib/state.svelte'
  import { resolveConflictLocal, resolveConflictRemote, syncNow } from '../lib/sync'
  import type { ConflictRow, OutboxRow } from '../lib/types'
  import Modal from './Modal.svelte'

  let { onclose }: { onclose: () => void } = $props()

  let outbox = $state<OutboxRow[]>([])
  let conflicts = $state<ConflictRow[]>([])
  let busy = $state(false)
  let error = $state('')

  $effect(() => {
    const sub = liveQuery(async () => ({
      outbox: await db.outbox.toArray(),
      conflicts: await db.conflicts.toArray()
    })).subscribe((value) => {
      outbox = value.outbox
      conflicts = value.conflicts
    })
    return () => sub.unsubscribe()
  })

  const counts = $derived.by(() => {
    const map = new Map<string, number>()
    for (const row of outbox) map.set(row.table, (map.get(row.table) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  })

  async function retry() {
    busy = true
    error = ''
    try {
      await syncNow()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  async function resolve(conflict: ConflictRow, mode: 'local' | 'remote') {
    busy = true
    error = ''
    try {
      if (mode === 'local') await resolveConflictLocal(conflict)
      else await resolveConflictRemote(conflict)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<Modal title="Synchronisation" {onclose}>
  <div class="stack">
    <div class="card card-pad">
      <div class="row between">
        <strong>{outbox.length} modification{outbox.length > 1 ? 's' : ''} en attente</strong>
        <button class="btn btn-sm btn-soft" onclick={retry} disabled={busy}>
          {busy ? '…' : 'Réessayer'}
        </button>
      </div>
      {#if counts.length}
        <p class="muted tiny" style="margin-top:6px">
          {counts.map(([table, count]) => `${table} : ${count}`).join(' · ')}
        </p>
      {:else}
        <p class="muted tiny" style="margin-top:6px">Tout est synchronisé.</p>
      {/if}
      {#if app.syncError}<p class="error" style="margin-top:10px">{app.syncError}</p>{/if}
      {#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}
    </div>

    {#if conflicts.length}
      <div class="section-title" style="margin-top:6px"><h2>Conflits</h2></div>
      {#each conflicts as conflict (conflict.id)}
        <div class="card card-pad">
          <strong>{conflict.table}</strong>
          <p class="muted tiny">Ligne {conflict.row_id}</p>
          <p class="muted tiny">
            Local : {String(conflict.local_payload.updated_at ?? '—')} · distant :
            {String(conflict.remote_payload.updated_at ?? '—')}
          </p>
          <div class="row wrap" style="margin-top:8px">
            <button class="btn btn-sm btn-soft" onclick={() => resolve(conflict, 'local')} disabled={busy}>
              Garder local
            </button>
            <button class="btn btn-sm" onclick={() => resolve(conflict, 'remote')} disabled={busy}>
              Prendre distant
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</Modal>
