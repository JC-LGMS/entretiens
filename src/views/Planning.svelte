<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { formatDate, todayISO } from '../lib/dates'
  import { app } from '../lib/state.svelte'
  import { urgencyOf, URGENCY_LABEL, type Urgency } from '../lib/urgency'
  import type { ActionRow, EntityRow } from '../lib/types'
  import UrgencyBadge from '../components/UrgencyBadge.svelte'

  interface Item {
    action: ActionRow
    entity: EntityRow
    muted: boolean
  }

  let items = $state<Item[]>([])

  $effect(() => {
    const profileId = app.profileId
    const sub = liveQuery(async () => {
      const entities = new Map(
        (await db.entities.toArray()).filter((e) => !e.deleted_at).map((e) => [e.id, e])
      )
      const actions = (await db.actions.toArray()).filter((a) => !a.deleted_at && a.active)
      const muted = new Set(
        (await db.profileMutes.toArray())
          .filter((m) => m.muted && m.profile_id === profileId)
          .map((m) => m.entity_id)
      )
      return actions
        .filter((a) => entities.has(a.entity_id))
        .map((a) => ({ action: a, entity: entities.get(a.entity_id)!, muted: muted.has(a.entity_id) }))
    }).subscribe((value) => {
      items = value
    })
    return () => sub.unsubscribe()
  })

  const groups = $derived.by(() => {
    const order: Urgency[] = ['overdue', 'today', 'soon', 'later']
    const sorted = [...items].sort((a, b) => a.action.next_due.localeCompare(b.action.next_due))
    return order
      .map((urgency) => ({
        urgency,
        label: URGENCY_LABEL[urgency],
        items: sorted.filter((item) => urgencyOf(item.action.next_due) === urgency)
      }))
      .filter((group) => group.items.length > 0)
  })

  const overdueCount = $derived(items.filter((item) => urgencyOf(item.action.next_due) === 'overdue').length)
</script>

<div class="row between" style="margin-bottom:12px">
  <div>
    <h1>Planning</h1>
    <p class="muted tiny">
      {formatDate(todayISO())} · {items.length} action{items.length > 1 ? 's' : ''}
      {overdueCount ? ` · ${overdueCount} en retard` : ''}
    </p>
  </div>
</div>

{#if groups.length === 0}
  <div class="card empty">
    <span class="big" aria-hidden="true">📅</span>
    <p>Aucune action planifiée.</p>
    <p class="tiny">Ajoutez une action depuis la fiche d'une entité.</p>
  </div>
{:else}
  {#each groups as group (group.urgency)}
    <div class="section-title">
      <h2>{group.label}</h2>
      <span class="badge {group.urgency}">{group.items.length}</span>
    </div>
    <div class="card">
      {#each group.items as item (item.action.id)}
        <a class="entity-row" href={`#/entity/${item.entity.id}`}>
          <div class="thumb" aria-hidden="true">
            {item.entity.kind === 'plante' ? '🌿' : item.entity.kind === 'administratif' ? '📄' : '🔧'}
          </div>
          <div class="entity-main">
            <strong>{item.action.label}</strong>
            <small>
              {item.entity.name} · {item.muted ? '🔕 notifications coupées' : 'rappels actifs'}
            </small>
          </div>
          <UrgencyBadge nextDue={item.action.next_due} />
        </a>
      {/each}
    </div>
  {/each}
{/if}
