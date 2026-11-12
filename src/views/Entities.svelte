<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { navigate } from '../lib/router.svelte'
  import { KINDS, type ActionRow, type EntityRow, type Kind } from '../lib/types'
  import EntityForm from '../components/EntityForm.svelte'
  import EntityPhoto from '../components/EntityPhoto.svelte'
  import UrgencyBadge from '../components/UrgencyBadge.svelte'

  let entities = $state<EntityRow[]>([])
  let actions = $state<ActionRow[]>([])
  let query = $state('')
  let filter = $state<'all' | Kind>('all')
  let showForm = $state(false)

  $effect(() => {
    const sub = liveQuery(async () => ({
      entities: (await db.entities.toArray()).filter((e) => !e.deleted_at),
      actions: (await db.actions.toArray()).filter((a) => !a.deleted_at && a.active)
    })).subscribe((value) => {
      entities = value.entities
      actions = value.actions
    })
    return () => sub.unsubscribe()
  })

  const rows = $derived.by(() => {
    const next = new Map<string, ActionRow>()
    for (const action of actions) {
      const current = next.get(action.entity_id)
      if (!current || action.next_due < current.next_due) next.set(action.entity_id, action)
    }
    const needle = query.trim().toLowerCase()
    return entities
      .filter((entity) => filter === 'all' || entity.kind === filter)
      .filter(
        (entity) =>
          !needle ||
          entity.name.toLowerCase().includes(needle) ||
          entity.notes.toLowerCase().includes(needle)
      )
      .map((entity) => ({ entity, next: next.get(entity.id) ?? null }))
      .sort((a, b) => {
        if (a.next && b.next) return a.next.next_due.localeCompare(b.next.next_due)
        if (a.next) return -1
        if (b.next) return 1
        return a.entity.name.localeCompare(b.entity.name, 'fr')
      })
  })

  function kindLabel(kind: Kind): string {
    return KINDS.find((k) => k.value === kind)?.label ?? kind
  }
</script>

<div class="row" style="margin-bottom:12px">
  <div class="search">
    <span aria-hidden="true">🔎</span>
    <input type="text" bind:value={query} placeholder="Rechercher une entité…" aria-label="Rechercher" />
  </div>
</div>

<div class="chips" role="group" aria-label="Filtrer par type">
  <button class="chip" class:active={filter === 'all'} onclick={() => (filter = 'all')}>Tous</button>
  {#each KINDS as kind}
    <button class="chip" class:active={filter === kind.value} onclick={() => (filter = kind.value)}>
      {kind.emoji} {kind.label}
    </button>
  {/each}
</div>

{#if rows.length === 0}
  <div class="card empty" style="margin-top:12px">
    <span class="big" aria-hidden="true">🌱</span>
    <p>{query || filter !== 'all' ? 'Aucun résultat.' : 'Aucune entité pour le moment.'}</p>
    {#if !query && filter === 'all'}
      <p class="tiny">Ajoutez un équipement, une plante ou une démarche administrative.</p>
    {/if}
  </div>
{:else}
  <div class="card" style="margin-top:12px">
    {#each rows as row (row.entity.id)}
      <a class="entity-row" href={`#/entity/${row.entity.id}`}>
        <EntityPhoto
          entityId={row.entity.id}
          photoPath={row.entity.photo_path}
          kind={row.entity.kind}
          alt={row.entity.name}
        />
        <div class="entity-main">
          <strong>{row.entity.name}</strong>
          <small>
            {kindLabel(row.entity.kind)}{row.entity.notes ? ` · ${row.entity.notes}` : ''}
          </small>
        </div>
        {#if row.next}
          <UrgencyBadge nextDue={row.next.next_due} />
        {:else}
          <span class="badge neutral">Aucune action</span>
        {/if}
      </a>
    {/each}
  </div>
{/if}

<button class="fab" aria-label="Ajouter une entité" onclick={() => (showForm = true)}>＋</button>

{#if showForm}
  <EntityForm
    onclose={() => (showForm = false)}
    onsaved={(entity) => navigate(`/entity/${entity.id}`)}
  />
{/if}
