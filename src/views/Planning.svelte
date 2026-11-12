<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { formatDate, formatShort, todayISO } from '../lib/dates'
  import { navigate } from '../lib/router.svelte'
  import { app } from '../lib/state.svelte'
  import { urgencyOf, URGENCY_LABEL, type Urgency } from '../lib/urgency'
  import { KINDS, type ActionRow, type EntityRow, type Kind } from '../lib/types'
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

  const overdueCount = $derived(
    items.filter((item) => urgencyOf(item.action.next_due) === 'overdue').length
  )

  function emojiFor(kind: Kind): string {
    return KINDS.find((k) => k.value === kind)?.emoji ?? '📦'
  }

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

<div class="row between" style="margin-bottom:12px">
  <div>
    <h1>Planning</h1>
    <p class="muted tiny">
      {formatDate(todayISO())} · {items.length} action{items.length > 1 ? 's' : ''}
      {overdueCount ? ` · ${overdueCount} en retard` : ''}
    </p>
  </div>
  <button class="btn btn-sm btn-primary desktop-add" onclick={startAction}>＋ Action</button>
</div>

<button class="fab mobile-only" aria-label="Ajouter une action" onclick={startAction}>＋</button>

{#if groups.length === 0}
  <div class="card empty">
    <span class="big" aria-hidden="true">📅</span>
    <p>Aucune action planifiée.</p>
    <p class="tiny">Ajoutez un équipement puis une action pour commencer.</p>
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
          <div class="thumb" aria-hidden="true">{emojiFor(item.entity.kind)}</div>
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
