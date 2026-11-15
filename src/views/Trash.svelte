<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, saveLocal } from '../lib/db'
  import { recalculateAction } from '../lib/actions'
  import { formatShort } from '../lib/dates'
  import type { ActionRow, EntityRow, LogRow } from '../lib/types'

  let entities = $state<EntityRow[]>([])
  let actions = $state<ActionRow[]>([])
  let logs = $state<LogRow[]>([])

  $effect(() => {
    const sub = liveQuery(async () => ({
      entities: (await db.entities.toArray()).filter((row) => row.deleted_at),
      actions: (await db.actions.toArray()).filter((row) => row.deleted_at),
      logs: (await db.logs.toArray()).filter((row) => row.deleted_at)
    })).subscribe((value) => {
      entities = value.entities
      actions = value.actions
      logs = value.logs
    })
    return () => sub.unsubscribe()
  })

  const entityName = (id: string) => entities.find((row) => row.id === id)?.name ?? ''
  const actionLabel = (id: string) => actions.find((row) => row.id === id)?.label ?? ''
  const actionEntity = (actionId: string) => actionLabel(actionId)

  async function restore(table: 'entities' | 'actions' | 'logs', row: { id: string }) {
    const now = new Date().toISOString()
    if (table === 'logs') {
      const log = await db.logs.get(row.id)
      if (!log) return
      await saveLocal('logs', { ...log, deleted_at: null, updated_at: now })
      await recalculateAction(log.action_id)
      return
    }
    const target = table === 'entities' ? db.entities : db.actions
    const full = await target.get(row.id)
    if (!full) return
    await saveLocal(table, { ...full, deleted_at: null, updated_at: now })
  }

  async function restoreEntityWithActions(entity: EntityRow) {
    await restore('entities', entity)
    const rows = await db.actions.where('entity_id').equals(entity.id).toArray()
    for (const row of rows.filter((action) => action.deleted_at)) {
      await saveLocal('actions', { ...row, deleted_at: null, updated_at: new Date().toISOString() })
    }
  }
</script>

<a href="#/settings" class="btn btn-ghost btn-sm" style="margin-bottom:10px">← Réglages</a>

<h1>Corbeille</h1>
<p class="muted tiny" style="margin-bottom:14px">
  Les éléments supprimés restent ici et peuvent être restaurés.
</p>

<div class="section-title"><h2>Entités</h2></div>
{#if entities.length === 0}
  <div class="card empty"><p>Aucune entité supprimée.</p></div>
{:else}
  <div class="card">
    {#each entities as entity (entity.id)}
      <div class="entity-row">
        <div class="entity-main">
          <strong>{entity.name}</strong>
          <small>Supprimée</small>
        </div>
        <button class="btn btn-sm" onclick={() => restoreEntityWithActions(entity)}>Restaurer</button>
      </div>
    {/each}
  </div>
{/if}

<div class="section-title"><h2>Actions</h2></div>
{#if actions.length === 0}
  <div class="card empty"><p>Aucune action supprimée.</p></div>
{:else}
  <div class="card">
    {#each actions as action (action.id)}
      <div class="entity-row">
        <div class="entity-main">
          <strong>{action.label}</strong>
          <small>{entityName(action.entity_id) || 'Entité supprimée'}</small>
        </div>
        <button class="btn btn-sm" onclick={() => restore('actions', action)}>Restaurer</button>
      </div>
    {/each}
  </div>
{/if}

<div class="section-title"><h2>Réalisations</h2></div>
{#if logs.length === 0}
  <div class="card empty"><p>Aucune réalisation supprimée.</p></div>
{:else}
  <div class="card">
    {#each logs as log (log.id)}
      <div class="entity-row">
        <div class="entity-main">
          <strong>{formatShort(log.done_on)} · {actionEntity(log.action_id) || 'Action supprimée'}</strong>
          <small>{log.comment || 'Sans commentaire'}</small>
        </div>
        <button class="btn btn-sm" onclick={() => restore('logs', log)}>Restaurer</button>
      </div>
    {/each}
  </div>
{/if}
