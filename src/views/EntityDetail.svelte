<script lang="ts">
  import { tick } from 'svelte'
  import { liveQuery } from 'dexie'
  import { db, saveActionMute, saveLocal, saveMute } from '../lib/db'
  import { addInterval, formatShort, intervalLabel, todayISO } from '../lib/dates'
  import { recordHistory } from '../lib/history'
  import { deleteLog, undoLastLog } from '../lib/actions'
  import { navigate } from '../lib/router.svelte'
  import { app } from '../lib/state.svelte'
  import type { ActionTemplate } from '../lib/templates'
  import { urgencyOf } from '../lib/urgency'
  import {
    KINDS,
    type ActionMuteRow,
    type ActionRow,
    type AttachmentRow,
    type EntityRow,
    type HistoryRow,
    type Kind,
    type LogRow,
    type ProfileMuteRow,
    type ProfileRow
  } from '../lib/types'
  import ActionForm from '../components/ActionForm.svelte'
  import AttachmentThumb from '../components/AttachmentThumb.svelte'
  import DoneDialog from '../components/DoneDialog.svelte'
  import EntityForm from '../components/EntityForm.svelte'
  import EntityPhoto from '../components/EntityPhoto.svelte'
  import Icon from '../components/Icon.svelte'
  import LogForm from '../components/LogForm.svelte'
  import TemplatePicker from '../components/TemplatePicker.svelte'
  import UrgencyBadge from '../components/UrgencyBadge.svelte'

  let { id, focusActionId }: { id: string; focusActionId?: string } = $props()

  interface DetailData {
    entity: EntityRow | null
    actions: ActionRow[]
    allActions: ActionRow[]
    logs: LogRow[]
    history: HistoryRow[]
    profiles: ProfileRow[]
    mute: ProfileMuteRow | null
    actionMutes: ActionMuteRow[]
    attachments: AttachmentRow[]
  }

  let data = $state<DetailData>({
    entity: null,
    actions: [],
    allActions: [],
    logs: [],
    history: [],
    profiles: [],
    mute: null,
    actionMutes: [],
    attachments: []
  })
  let showEntityForm = $state(false)
  let showArchivedActions = $state(false)
  let showModifications = $state(false)
  let showTemplates = $state(false)
  let editingLog = $state<LogRow | null>(null)
  let actionForm = $state<{ open: boolean; action?: ActionRow; template?: ActionTemplate }>({
    open: false
  })
  let doneAction = $state<ActionRow | null>(null)
  let lastFocused = ''

  $effect(() => {
    const entityId = id
    const profileId = app.profileId
    const sub = liveQuery(async (): Promise<DetailData> => {
      const entity = (await db.entities.get(entityId)) ?? null
      const allActions = await db.actions.where('entity_id').equals(entityId).toArray()
      const ids = allActions.map((action) => action.id)
      const logs = ids.length ? await db.logs.where('action_id').anyOf(ids).toArray() : []
      const history = await db.history.where('entity_id').equals(entityId).toArray()
      const profiles = await db.profiles.toArray()
      const mute = profileId
        ? ((await db.profileMutes.where('[profile_id+entity_id]').equals([profileId, entityId]).first()) ??
          null)
        : null
      const actionMutes = profileId
        ? await db.actionMutes.filter((row) => row.profile_id === profileId && !row.deleted_at).toArray()
        : []
      const attachments = (
        await db.attachments.where('owner_id').anyOf([entityId, ...ids]).toArray()
      ).filter(
        (row) =>
          !row.deleted_at &&
          ((row.owner_type === 'entity' && row.owner_id === entityId) ||
            (row.owner_type === 'action' && ids.includes(row.owner_id)))
      )
      return {
        entity,
        allActions,
        actions: allActions.filter((action) => !action.deleted_at),
        logs,
        history,
        profiles,
        mute,
        actionMutes,
        attachments
      }
    }).subscribe((value) => {
      data = value
    })
    return () => sub.unsubscribe()
  })

  $effect(() => {
    const actionId = focusActionId
    if (!actionId || !data.entity || lastFocused === actionId) return
    lastFocused = actionId
    void tick().then(() => {
      document
        .getElementById(`action-${actionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  })

  const muted = $derived(Boolean(data.mute?.muted && !data.mute?.deleted_at))
  const archived = $derived(Boolean(data.entity?.archived))
  const visibleActions = $derived(data.actions.filter((action) => !action.archived))
  const archivedActions = $derived(data.actions.filter((action) => action.archived))
  const totalCost = $derived(
    data.logs
      .filter((log) => !log.deleted_at && typeof log.cost === 'number')
      .reduce((sum, log) => sum + (log.cost ?? 0), 0)
  )

  const realisations = $derived.by(() => {
    const labels = new Map(data.allActions.map((action) => [action.id, action.label]))
    const names = new Map(data.profiles.map((profile) => [profile.id, profile.name]))
    return data.logs
      .filter((log) => !log.deleted_at)
      .map((log) => ({
        id: log.id,
        at: new Date(`${log.done_on}T12:00:00`).toISOString(),
        title: `Action « ${labels.get(log.action_id) ?? 'supprimée'} » faite`,
        text: log.comment,
        cost: log.cost ?? null,
        checklist: log.checklist_done ?? [],
        who: names.get(log.created_by ?? '') ?? '',
        log
      }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80)
  })

  const modifications = $derived.by(() => {
    const names = new Map(data.profiles.map((profile) => [profile.id, profile.name]))
    return data.history
      .filter((row) => !row.deleted_at)
      .map((row) => ({
        id: row.id,
        at: row.created_at,
        title: row.summary,
        who: names.get(row.profile_id ?? '') ?? ''
      }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80)
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

  function assigneeName(action: ActionRow): string {
    return data.profiles.find((profile) => profile.id === action.assigned_profile_id)?.name ?? ''
  }

  function actionMuted(action: ActionRow): boolean {
    return Boolean(
      data.actionMutes.find((row) => row.action_id === action.id && row.muted && !row.deleted_at)
    )
  }

  async function toggleMute() {
    if (!app.profileId || !data.entity) return
    const next = !muted
    await saveMute({
      profile_id: app.profileId,
      entity_id: data.entity.id,
      muted: next,
      updated_at: new Date().toISOString(),
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

  async function toggleActionMute(action: ActionRow) {
    if (!app.profileId || !data.entity) return
    const next = !actionMuted(action)
    await saveActionMute({
      profile_id: app.profileId,
      action_id: action.id,
      muted: next,
      updated_at: new Date().toISOString(),
      deleted_at: null
    })
    const who = app.profile?.name ?? 'ce profil'
    await recordHistory(
      data.entity.id,
      action.id,
      app.profileId,
      'notify_toggled',
      next
        ? `Notifications coupées pour « ${action.label} » (${who})`
        : `Notifications réactivées pour « ${action.label} » (${who})`
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
      last_notified_on: null,
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

  async function toggleEntityArchive() {
    if (!data.entity) return
    const next = !archived
    await saveLocal('entities', {
      ...data.entity,
      archived: next,
      updated_at: new Date().toISOString()
    })
    await recordHistory(
      data.entity.id,
      null,
      app.profileId,
      next ? 'entity_archived' : 'entity_restored',
      next ? 'Entité archivée' : 'Entité désarchivée'
    )
  }

  async function toggleActionArchive(action: ActionRow) {
    if (!data.entity) return
    const next = !action.archived
    await saveLocal('actions', {
      ...action,
      archived: next,
      active: next ? false : true,
      updated_at: new Date().toISOString()
    })
    await recordHistory(
      data.entity.id,
      action.id,
      app.profileId,
      next ? 'action_archived' : 'action_restored',
      next ? `Action « ${action.label} » archivée` : `Action « ${action.label} » désarchivée`
    )
  }

  async function duplicateEntity() {
    if (!data.entity) return
    const now = new Date().toISOString()
    const copyId = crypto.randomUUID()
    const entity: EntityRow = {
      ...data.entity,
      id: copyId,
      name: `${data.entity.name} (copie)`,
      photo_path: null,
      warranty_notified_on: null,
      updated_at: now,
      deleted_at: null
    }
    await saveLocal('entities', entity)
    for (const action of visibleActions) {
      const row: ActionRow = {
        ...action,
        id: crypto.randomUUID(),
        entity_id: copyId,
        last_done: null,
        next_due: action.next_due,
        last_notified_on: null,
        notified_for: null,
        updated_at: now,
        deleted_at: null
      }
      await saveLocal('actions', row)
    }
    await recordHistory(copyId, null, app.profileId, 'entity_created', 'Entité dupliquée')
    navigate(`/entity/${copyId}`)
  }

  async function removeLog(log: LogRow) {
    if (!confirm('Supprimer cette réalisation ? L’échéance sera recalculée.')) return
    await deleteLog(log)
  }

  async function undo(action: ActionRow) {
    if (!confirm(`Annuler la dernière réalisation de « ${action.label} » ?`)) return
    await undoLastLog(action.id)
  }

  function latestLogFor(action: ActionRow): LogRow | null {
    const logs = data.logs
      .filter((log) => log.action_id === action.id && !log.deleted_at)
      .sort((a, b) => b.done_on.localeCompare(a.done_on))
    return logs[0] ?? null
  }

  function actionCost(actionId: string): number {
    return data.logs
      .filter(
        (log) => log.action_id === actionId && !log.deleted_at && typeof log.cost === 'number'
      )
      .reduce((sum, log) => sum + (log.cost ?? 0), 0)
  }

  function money(value: number): string {
    return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
  }

  function actionPhotos(actionId: string): AttachmentRow[] {
    return data.attachments.filter(
      (row) => row.owner_type === 'action' && row.owner_id === actionId && !row.deleted_at
    )
  }

  const entityDocuments = $derived(
    data.attachments.filter(
      (row) => row.owner_type === 'entity' && row.owner_id === data.entity?.id && !row.deleted_at
    )
  )

  function editAction(action: ActionRow) {
    actionForm = { open: true, action }
  }

  function pickTemplate(template: ActionTemplate) {
    showTemplates = false
    actionForm = { open: true, template }
  }
</script>

<a
  href={focusActionId ? '#/' : '#/entities'}
  class="btn btn-ghost btn-sm"
  style="margin-bottom:10px"
>
  ← {focusActionId ? 'Planning' : 'Entités'}
</a>

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
        zoomable
      />
      <div style="min-width:0">
        <div class="row between wrap">
          <h1>{data.entity.name}</h1>
          <div class="row wrap">
            <button class="btn btn-sm" onclick={() => (showEntityForm = true)}>Modifier</button>
            <button class="btn btn-sm" onclick={duplicateEntity}>Dupliquer</button>
            <button class="btn btn-sm" onclick={toggleEntityArchive}>
              {archived ? 'Désarchiver' : 'Archiver'}
            </button>
          </div>
        </div>
        <p class="muted">
          {kindLabel(data.entity.kind)}
          {#if archived}<span class="badge neutral" style="margin-left:6px">Archivée</span>{/if}
        </p>
        {#if data.entity.notes}<p style="margin-top:6px">{data.entity.notes}</p>{/if}
        {#if data.entity.warranty_until}
          <p class="muted tiny" style="margin-top:6px">
            Garantie jusqu’au {formatShort(data.entity.warranty_until)}
          </p>
        {/if}
        {#if totalCost > 0}
          <p class="muted tiny" style="margin-top:4px">
            Coût total : {totalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        {/if}
        <div class="entity-documents">
          <div class="row between wrap" style="margin-bottom:6px">
            <strong class="tiny">Documents</strong>
            <span class="muted tiny">
              {entityDocuments.length
                ? `${entityDocuments.length} document${entityDocuments.length > 1 ? 's' : ''}`
                : 'Aucun document'}
            </span>
          </div>
          {#if entityDocuments.length}
            <div class="attachment-grid">
              {#each entityDocuments as doc (doc.id)}
                <div class="attachment-item">
                  <AttachmentThumb attachment={doc} />
                </div>
              {/each}
            </div>
          {:else}
            <p class="muted tiny">
              Ajoutez des documents en modifiant l’entité.
            </p>
          {/if}
        </div>
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
    <div class="row wrap">
      <button class="btn btn-sm btn-ghost" onclick={() => (showTemplates = true)}>Modèles</button>
      <button class="btn btn-sm btn-soft" onclick={() => (actionForm = { open: true })}>+ Ajouter</button>
    </div>
  </div>

  {#if visibleActions.length === 0}
    <div class="card empty">
      <p>Aucune action pour cette entité.</p>
      <p class="tiny">Ajoutez par exemple « Entretien tous les 6 mois ».</p>
    </div>
  {:else}
    <div class="stack">
      {#each visibleActions as action (action.id)}
        <div
          class={`card action-card ${urgencyOf(action.next_due)}`}
          class:highlighted={focusActionId === action.id}
          id={`action-${action.id}`}
        >
          <div class="action-head">
            <button
              type="button"
              class="action-title"
              onclick={() => editAction(action)}
              title="Modifier l’action"
            >
              <strong>{action.label}</strong>
            </button>
            <button
              class="btn btn-ghost icon-btn pencil-btn"
              aria-label={`Modifier ${action.label}`}
              title="Modifier"
              onclick={() => editAction(action)}
            >
              <Icon name="edit" size={15} />
            </button>
            {#if action.active}
              <UrgencyBadge nextDue={action.next_due} />
            {:else}
              <span class="badge neutral">Inactive</span>
            {/if}
          </div>
          {#if action.description}<p class="muted tiny" style="margin-top:4px">{action.description}</p>{/if}
          <div class="action-meta">
            <span>{intervalLabel(action.interval_value, action.interval_unit)}</span>
            {#if action.last_done}<span>Dernière fois : {formatShort(action.last_done)}</span>{/if}
            <span>Prochaine : {formatShort(action.next_due)}</span>
            {#if actionCost(action.id) > 0}
              <span>Coût total : {money(actionCost(action.id))}</span>
            {/if}
            {#if assigneeName(action)}<span>Assignée à {assigneeName(action)}</span>{/if}
            {#if action.notify_lead_days > 0}<span>Rappel J-{action.notify_lead_days}</span>{/if}
            {#if action.overdue_repeat_days > 0}<span>Relance tous les {action.overdue_repeat_days} j</span>{/if}
          </div>
          {#if action.checklist?.length}
            <div class="checklist-preview">
              {#each action.checklist as item (item)}<span class="badge neutral">☐ {item}</span>{/each}
            </div>
          {/if}
          <div class="action-buttons">
            {#if action.active}
              <button class="btn btn-sm btn-primary" onclick={() => (doneAction = action)}>C'est fait</button>
              <span class="tiny muted" style="align-self:center">Reporter :</span>
              <button class="btn btn-sm" onclick={() => snooze(action, 1)}>+1 j</button>
              <button class="btn btn-sm" onclick={() => snooze(action, 3)}>+3 j</button>
              <button class="btn btn-sm" onclick={() => snooze(action, 7)}>+7 j</button>
              {#if latestLogFor(action)}
                <button class="btn btn-sm btn-ghost" onclick={() => undo(action)}>Annuler la dernière</button>
              {/if}
            {/if}
            <button class="btn btn-sm btn-ghost" onclick={() => toggleActionMute(action)}>
              {actionMuted(action) ? '🔕' : '🔔'}
            </button>
            <button class="btn btn-sm btn-ghost archive-btn" onclick={() => toggleActionArchive(action)}>
              Archiver
            </button>
          </div>
          {#if actionPhotos(action.id).length}
            <div class="action-photos">
              {#each actionPhotos(action.id) as photo (photo.id)}
                <div class="attachment-item">
                  <AttachmentThumb attachment={photo} />
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if archivedActions.length > 0}
    <div class="section-title">
      <h2>Actions archivées</h2>
      <button class="btn btn-sm btn-ghost" onclick={() => (showArchivedActions = !showArchivedActions)}>
        {showArchivedActions ? 'Masquer' : `${archivedActions.length} archivée${archivedActions.length > 1 ? 's' : ''}`}
      </button>
    </div>

    {#if showArchivedActions}
      <div class="stack">
        {#each archivedActions as action (action.id)}
          <div
            class="card action-card"
            class:highlighted={focusActionId === action.id}
            id={`action-${action.id}`}
            style="opacity:0.72"
          >
            <div class="action-head">
              <button
                type="button"
                class="action-title"
                onclick={() => editAction(action)}
                title="Modifier l’action"
              >
                <strong>{action.label}</strong>
              </button>
              <button
                class="btn btn-ghost icon-btn pencil-btn"
                aria-label={`Modifier ${action.label}`}
                title="Modifier"
                onclick={() => editAction(action)}
              >
                <Icon name="edit" size={15} />
              </button>
              <span class="badge neutral">Archivée</span>
            </div>
            <div class="action-meta">
              <span>{intervalLabel(action.interval_value, action.interval_unit)}</span>
              {#if action.last_done}<span>Dernière fois : {formatShort(action.last_done)}</span>{/if}
              <span>Prochaine : {formatShort(action.next_due)}</span>
            </div>
            <div class="action-buttons">
              <button class="btn btn-sm btn-soft archive-btn" onclick={() => toggleActionArchive(action)}>
                Désarchiver
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="section-title"><h2>Réalisations</h2></div>

  {#if realisations.length === 0}
    <div class="card empty"><p>Aucune réalisation enregistrée.</p></div>
  {:else}
    <div class="card card-pad">
      <div class="timeline">
        {#each realisations as entry, index (entry.id)}
          <div class="timeline-item">
            <p class="realisation-line">
              <span class="when">{when(entry.at)}{entry.who ? ` · ${entry.who}` : ''}</span>
              <span>{entry.title}</span>
              {#if typeof entry.cost === 'number'}
                <span class="badge neutral">{entry.cost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
              {/if}
            </p>
            {#if entry.text}<p class="realisation-comment">{entry.text}</p>{/if}
            {#if entry.checklist.length}
              <p class="tiny muted" style="margin-top:4px">Checklist : {entry.checklist.join(', ')}</p>
            {/if}
            <div class="row wrap realisation-actions" style="margin-top:4px">
              <button
                class="btn btn-sm btn-ghost icon-btn"
                aria-label="Modifier cette réalisation"
                title="Modifier"
                onclick={() => (editingLog = entry.log)}
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                class="btn btn-sm btn-danger icon-btn realisation-delete"
                aria-label="Supprimer cette réalisation"
                title="Supprimer"
                onclick={() => removeLog(entry.log)}
              >
                <Icon name="trash" size={14} />
              </button>
              {#if index === 0}
                <span class="tiny muted">Dernière réalisation</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if modifications.length > 0}
    <button
      class="section-title section-toggle"
      aria-expanded={showModifications}
      onclick={() => (showModifications = !showModifications)}
    >
      <span class="section-label">Modifications</span>
      <span class="badge neutral">{modifications.length} {showModifications ? '▲' : '▼'}</span>
    </button>

    {#if showModifications}
      <div class="card card-pad">
        <div class="timeline">
          {#each modifications as entry (entry.id)}
            <div class="timeline-item">
              <div class="when">{when(entry.at)}{entry.who ? ` · ${entry.who}` : ''}</div>
              <p>{entry.title}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
{/if}

{#if showEntityForm && data.entity}
  <EntityForm entity={data.entity} onclose={() => (showEntityForm = false)} />
{/if}

{#if actionForm.open}
  <ActionForm
    entityId={id}
    entityName={data.entity?.name}
    action={actionForm.action}
    template={actionForm.template}
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

{#if editingLog}
  <LogForm log={editingLog} onclose={() => (editingLog = null)} />
{/if}

{#if showTemplates && data.entity}
  <TemplatePicker
    entityName={data.entity.name}
    onpick={pickTemplate}
    onclose={() => (showTemplates = false)}
  />
{/if}
