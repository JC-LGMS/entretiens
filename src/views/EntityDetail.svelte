<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, saveLocal, saveMute } from '../lib/db'
  import { addInterval, formatShort, intervalLabel, todayISO } from '../lib/dates'
  import { recordHistory } from '../lib/history'
  import { app } from '../lib/state.svelte'
  import { KINDS, type ActionRow, type EntityRow, type HistoryRow, type Kind, type LogRow, type ProfileMuteRow, type ProfileRow } from '../lib/types'
  import ActionForm from '../components/ActionForm.svelte'
  import DoneDialog from '../components/DoneDialog.svelte'
  import EntityForm from '../components/EntityForm.svelte'
  import EntityPhoto from '../components/EntityPhoto.svelte'
  import UrgencyBadge from '../components/UrgencyBadge.svelte'

  let { id }: { id: string } = $props()

  interface DetailData {
    entity: EntityRow | null
    actions: ActionRow[]
    allActions: ActionRow[]
    logs: LogRow[]
    history: HistoryRow[]
    profiles: ProfileRow[]
    mute: ProfileMuteRow | null
  }

  let data = $state<DetailData>({
    entity: null,
    actions: [],
    allActions: [],
    logs: [],
    history: [],
    profiles: [],
    mute: null
  })
  let showEntityForm = $state(false)
  let actionForm = $state<{ open: boolean; action?: ActionRow }>({ open: false })
  let doneAction = $state<ActionRow | null>(null)

  $effect(() => {
    const entityId = id
    const profileId = app.profileId
    const sub = liveQuery(async (): Promise<DetailData> => {
      const entity = (await db.entities.get(entityId)) ?? null
      const allActions = await db.actions.where('entity_id').equals(entityId).toArray()
      const ids = allActions.map((a) => a.id)
      const logs = ids.length ? await db.logs.where('action_id').anyOf(ids).toArray() : []
      const history = await db.history.where('entity_id').equals(entityId).toArray()
      const profiles = await db.profiles.toArray()
      const mute = profileId
        ? ((await db.profileMutes.where('[profile_id+entity_id]').equals([profileId, entityId]).first()) ??
          null)
        : null
      return {
        entity,
        allActions,
        actions: allActions.filter((a) => !a.deleted_at),
        logs,
        history,
        profiles,
        mute
      }
    }).subscribe((value) => {
      data = value
    })
    return () => sub.unsubscribe()
  })

  const muted = $derived(Boolean(data.mute?.muted))

  const timeline = $derived.by(() => {
    const labels = new Map(data.allActions.map((a) => [a.id, a.label]))
    const names = new Map(data.profiles.map((p) => [p.id, p.name]))
    const entries: { id: string; at: string; title: string; text: string; who: string }[] = []

    for (const log of data.logs) {
      if (log.deleted_at) continue
      entries.push({
        id: log.id,
        at: new Date(`${log.done_on}T12:00:00`).toISOString(),
        title: `Action « ${labels.get(log.action_id) ?? 'supprimée'} » faite`,
        text: log.comment,
        who: names.get(log.created_by ?? '') ?? ''
      })
    }
    for (const row of data.history) {
      if (row.deleted_at) continue
      entries.push({
        id: row.id,
        at: row.created_at,
        title: row.summary,
        text: '',
        who: names.get(row.profile_id ?? '') ?? ''
      })
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80)
  })

  function kindLabel(kind: Kind): string {
    return KINDS.find((k) => k.value === kind)?.label ?? kind
  }

  function when(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  async function toggleMute() {
    if (!app.profileId || !data.entity) return
    const next = !muted
    const now = new Date().toISOString()
    await saveMute({
      profile_id: app.profileId,
      entity_id: data.entity.id,
      muted: next,
      updated_at: now,
      deleted_at: null
    })
    const who = app.profile?.name ?? 'ce profil'
    await recordHistory(
      data.entity.id,
      null,
      app.profileId,
      'notify_toggled',
      next ? `Notifications coupées pour ${who}` : `Notifications réactivées pour ${who}`
    )
  }

  async function snooze(action: ActionRow, days: number) {
    if (!data.entity) return
    const base = action.next_due < todayISO() ? todayISO() : action.next_due
    const next = addInterval(base, days, 'day')
    await saveLocal('actions', {
      ...action,
      next_due: next,
      notified_for: null,
      updated_at: new Date().toISOString()
    })
    await recordHistory(
      data.entity.id,
      action.id,
      app.profileId,
      'due_changed',
      `Échéance reportée au ${formatShort(next)} (+${days} j)`
    )
  }
</script>

<a href="#/" class="btn btn-ghost btn-sm" style="margin-bottom:10px">← Entités</a>

{#if !data.entity || data.entity.deleted_at}
  <div class="card empty">
    <span class="big" aria-hidden="true">🫥</span>
    <p>Cette entité n'existe plus.</p>
  </div>
{:else}
  <div class="card card-pad">
    <div class="hero">
      <EntityPhoto
        entityId={data.entity.id}
        photoPath={data.entity.photo_path}
        kind={data.entity.kind}
        alt={data.entity.name}
      />
      <div style="min-width:0">
        <div class="row between">
          <h1>{data.entity.name}</h1>
          <button class="btn btn-sm" onclick={() => (showEntityForm = true)}>Modifier</button>
        </div>
        <p class="muted">{kindLabel(data.entity.kind)}</p>
        {#if data.entity.notes}<p style="margin-top:6px">{data.entity.notes}</p>{/if}
      </div>
    </div>

    <button
      class="btn btn-sm {muted ? 'btn-danger' : 'btn-soft'}"
      style="margin-top:14px"
      onclick={toggleMute}
      aria-pressed={muted}
    >
      {muted ? '🔕 Notifications coupées' : '🔔 Notifications activées'}
      <span class="tiny muted">· {app.profile?.name ?? 'profil'}</span>
    </button>
  </div>

  <div class="section-title">
    <h2>Actions</h2>
    <button class="btn btn-sm btn-soft" onclick={() => (actionForm = { open: true })}>+ Ajouter</button>
  </div>

  {#if data.actions.length === 0}
    <div class="card empty">
      <p>Aucune action pour cette entité.</p>
      <p class="tiny">Ajoutez par exemple « Entretien tous les 6 mois ».</p>
    </div>
  {:else}
    <div class="stack">
      {#each data.actions as action (action.id)}
        <div class="card action-card">
          <div class="action-head">
            <strong>{action.label}</strong>
            {#if action.active}
              <UrgencyBadge nextDue={action.next_due} />
            {:else}
              <span class="badge neutral">Inactive</span>
            {/if}
          </div>
          <div class="action-meta">
            <span>{intervalLabel(action.interval_value, action.interval_unit)}</span>
            {#if action.last_done}<span>Dernière fois : {formatShort(action.last_done)}</span>{/if}
            <span>Prochaine : {formatShort(action.next_due)}</span>
          </div>
          <div class="action-buttons">
            {#if action.active}
              <button class="btn btn-sm btn-primary" onclick={() => (doneAction = action)}>C'est fait</button>
              <span class="tiny muted" style="align-self:center">Reporter :</span>
              <button class="btn btn-sm" onclick={() => snooze(action, 1)}>+1 j</button>
              <button class="btn btn-sm" onclick={() => snooze(action, 3)}>+3 j</button>
              <button class="btn btn-sm" onclick={() => snooze(action, 7)}>+7 j</button>
            {/if}
            <button class="btn btn-sm" onclick={() => (actionForm = { open: true, action })}>Modifier</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="section-title">
    <h2>Historique</h2>
  </div>

  {#if timeline.length === 0}
    <div class="card empty"><p>Rien à afficher pour le moment.</p></div>
  {:else}
    <div class="card card-pad">
      <div class="timeline">
        {#each timeline as entry (entry.id)}
          <div class="timeline-item">
            <div class="when">{when(entry.at)}{entry.who ? ` · ${entry.who}` : ''}</div>
            <p>{entry.title}</p>
            {#if entry.text}<p class="muted">{entry.text}</p>{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}

{#if showEntityForm && data.entity}
  <EntityForm entity={data.entity} onclose={() => (showEntityForm = false)} />
{/if}

{#if actionForm.open}
  <ActionForm
    entityId={id}
    action={actionForm.action}
    onclose={() => (actionForm = { open: false })}
  />
{/if}

{#if doneAction && data.entity}
  <DoneDialog
    action={doneAction}
    entityName={data.entity.name}
    onclose={() => (doneAction = null)}
  />
{/if}
