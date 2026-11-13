<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { formatDate, formatShort, todayISO } from '../lib/dates'
  import { navigate } from '../lib/router.svelte'
  import { app } from '../lib/state.svelte'
  import { urgencyOf, URGENCY_LABEL, type Urgency } from '../lib/urgency'
  import type { ActionRow, EntityRow } from '../lib/types'
  import ActionForm from '../components/ActionForm.svelte'
  import EntityForm from '../components/EntityForm.svelte'
  import EntityPhoto from '../components/EntityPhoto.svelte'
  import Modal from '../components/Modal.svelte'
  import UrgencyBadge from '../components/UrgencyBadge.svelte'

  interface Item {
    action: ActionRow
    entity: EntityRow
    muted: boolean
  }

  let items = $state<Item[]>([])
  let entities = $state<EntityRow[]>([])
  let query = $state('')
  let showEntityForm = $state(false)
  let showEntityPicker = $state(false)
  let actionEntityId = $state<string | null>(null)
  let actionEntityName = $state('')
  let createForAction = $state(false)

  $effect(() => {
    const profileId = app.profileId
    const sub = liveQuery(async () => {
      const entityMap = new Map(
        (await db.entities.toArray())
          .filter((e) => !e.deleted_at && !e.archived)
          .map((e) => [e.id, e])
      )
      const actions = (await db.actions.toArray()).filter(
        (a) => !a.deleted_at && !a.archived && a.active
      )
      const muted = new Set(
        (await db.profileMutes.toArray())
          .filter((m) => m.muted && m.profile_id === profileId)
          .map((m) => m.entity_id)
      )
      const visibleEntities = [...entityMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      )
      return {
        entities: visibleEntities,
        items: actions
          .filter((a) => entityMap.has(a.entity_id))
          .map((a) => ({
            action: a,
            entity: entityMap.get(a.entity_id)!,
            muted: muted.has(a.entity_id)
          }))
      }
    }).subscribe((value) => {
      entities = value.entities
      items = value.items
    })
    return () => sub.unsubscribe()
  })

  const filteredItems = $derived.by(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (item) =>
        item.action.label.toLowerCase().includes(needle) ||
        item.entity.name.toLowerCase().includes(needle) ||
        (item.action.description ?? '').toLowerCase().includes(needle)
    )
  })

  const groups = $derived.by(() => {
    const order: Urgency[] = ['overdue', 'today', 'soon', 'later']
    const sorted = [...filteredItems].sort((a, b) =>
      a.action.next_due.localeCompare(b.action.next_due)
    )
    return order
      .map((urgency) => ({
        urgency,
        label: URGENCY_LABEL[urgency],
        items: sorted.filter((item) => urgencyOf(item.action.next_due) === urgency)
      }))
      .filter((group) => group.items.length > 0)
  })

  const overdueCount = $derived(
    filteredItems.filter((item) => urgencyOf(item.action.next_due) === 'overdue').length
  )

  function startAction() {
    if (entities.length === 0) {
      createForAction = true
      showEntityForm = true
      return
    }
    showEntityPicker = true
  }

  function createEntityForAction() {
    showEntityPicker = false
    createForAction = true
    showEntityForm = true
  }
</script>

<div class="row between planning-head" style="margin-bottom:12px">
  <h1>Planning</h1>
  <div class="planning-meta">
    <span class="muted tiny">{formatDate(todayISO())}</span>
    <span class="badge neutral">
      {filteredItems.length} action{filteredItems.length > 1 ? 's' : ''}
    </span>
    {#if overdueCount}
      <span class="badge overdue">{overdueCount} en retard</span>
    {/if}
  </div>
  <button class="btn btn-sm btn-primary desktop-add" onclick={startAction}>＋ Action</button>
</div>

<div class="search" style="margin-bottom:12px">
  <span aria-hidden="true">🔎</span>
  <input
    type="text"
    bind:value={query}
    placeholder="Rechercher une action…"
    aria-label="Rechercher une action"
  />
</div>

<button class="fab mobile-only" aria-label="Ajouter une action" onclick={startAction}>＋</button>

{#if groups.length === 0}
  <div class="card empty">
    <span class="big" aria-hidden="true">📅</span>
    <p>{query ? 'Aucune action trouvée.' : 'Aucune action planifiée.'}</p>
    {#if !query}
      <p class="tiny">Ajoutez un équipement puis une action pour commencer.</p>
    {/if}
  </div>
{:else}
  {#each groups as group (group.urgency)}
    <div class="section-title">
      <h2>{group.label}</h2>
      <span class="badge {group.urgency}">{group.items.length}</span>
    </div>
    <div class="card">
      {#each group.items as item (item.action.id)}
        <a
          class={`entity-row planning-row ${urgencyOf(item.action.next_due)}`}
          href={`#/entity/${item.entity.id}?action=${item.action.id}`}
        >
          <EntityPhoto
            entityId={item.entity.id}
            photoPath={item.entity.photo_path}
            kind={item.entity.kind}
            alt={item.entity.name}
          />
          <div class="entity-main">
            <strong>{item.action.label}</strong>
            <small>{item.entity.name}{item.muted ? ' · 🔕 notifications coupées' : ''}</small>
          </div>
          <div class="due-right">
            <UrgencyBadge nextDue={item.action.next_due} />
            <span class="tiny muted">{formatShort(item.action.next_due)}</span>
          </div>
        </a>
      {/each}
    </div>
  {/each}
{/if}

{#if showEntityForm}
  <EntityForm
    onclose={() => (showEntityForm = false)}
    onsaved={(entity) => {
      showEntityForm = false
      if (createForAction) {
        actionEntityId = entity.id
        actionEntityName = entity.name
        createForAction = false
      } else {
        navigate(`/entity/${entity.id}`)
      }
    }}
  />
{/if}

{#if showEntityPicker}
  <Modal title="Ajouter une action" onclose={() => (showEntityPicker = false)}>
    <p class="muted" style="margin-bottom:10px">Choisir l'entité concernée.</p>
    <div class="profile-list">
      {#each entities as entity (entity.id)}
        <button
          class="profile-option"
          onclick={() => {
            actionEntityId = entity.id
            actionEntityName = entity.name
            showEntityPicker = false
          }}
        >
          <EntityPhoto
            entityId={entity.id}
            photoPath={entity.photo_path}
            kind={entity.kind}
            alt={entity.name}
          />
          <span>{entity.name}</span>
        </button>
      {/each}
    </div>
    <button class="btn btn-soft" style="margin-top:10px;width:100%" onclick={createEntityForAction}>
      ＋ Créer une nouvelle entité
    </button>
  </Modal>
{/if}

{#if actionEntityId}
  <ActionForm
    entityId={actionEntityId}
    entityName={actionEntityName}
    onclose={() => {
      actionEntityId = null
      actionEntityName = ''
    }}
  />
{/if}
