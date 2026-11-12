<script lang="ts">
  import { untrack } from 'svelte'
  import { app } from '../lib/state.svelte'
  import { recordHistory } from '../lib/history'
  import { saveLocal, softDelete, db } from '../lib/db'
  import { removeEntityPhoto, setEntityPhoto } from '../lib/photos'
  import { joinSummary, describeChange } from '../lib/summary'
  import { KINDS, type EntityRow, type Kind } from '../lib/types'
  import EntityPhoto from './EntityPhoto.svelte'
  import Modal from './Modal.svelte'

  let {
    entity,
    onclose,
    onsaved
  }: { entity?: EntityRow; onclose: () => void; onsaved?: (entity: EntityRow) => void } = $props()

  const initial = untrack(() => ({
    name: entity?.name ?? '',
    kind: entity?.kind ?? ('equipement' as Kind),
    notes: entity?.notes ?? ''
  }))
  let name = $state(initial.name)
  let kind = $state<Kind>(initial.kind)
  let notes = $state(initial.notes)
  let file = $state<File | null>(null)
  let busy = $state(false)
  let error = $state('')

  function onphoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    file = input.files?.[0] ?? null
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!name.trim()) {
      error = 'Le nom est obligatoire.'
      return
    }
    busy = true
    error = ''
    try {
      const now = new Date().toISOString()
      if (!entity) {
        const row: EntityRow = {
          id: crypto.randomUUID(),
          kind,
          name: name.trim(),
          notes: notes.trim(),
          photo_path: null,
          archived: false,
          updated_at: now,
          deleted_at: null
        }
        await saveLocal('entities', row)
        await recordHistory(row.id, null, app.profileId, 'entity_created', 'Entité créée')
        let saved = row
        if (file) saved = await setEntityPhoto(row, file)
        onclose()
        onsaved?.(saved)
        return
      }

      const updated: EntityRow = {
        ...entity,
        kind,
        name: name.trim(),
        notes: notes.trim(),
        updated_at: now
      }
      const summary = joinSummary([
        describeChange('Nom', entity.name, updated.name),
        describeChange('Type', kindLabel(entity.kind), kindLabel(updated.kind)),
        entity.notes !== updated.notes ? 'Notes modifiées' : null
      ])
      await saveLocal('entities', updated)
      if (summary) await recordHistory(entity.id, null, app.profileId, 'entity_updated', summary)
      let saved = updated
      if (file) {
        saved = await setEntityPhoto(updated, file)
        await recordHistory(entity.id, null, app.profileId, 'photo_updated', 'Photo modifiée')
      }
      onclose()
      onsaved?.(saved)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  async function remove() {
    if (!entity) return
    if (!confirm(`Supprimer « ${entity.name} » et ses actions ? L'historique est conservé.`)) return
    busy = true
    try {
      const actions = await db.actions.where('entity_id').equals(entity.id).toArray()
      for (const action of actions) {
        await softDelete('actions', action.id)
      }
      await softDelete('entities', entity.id)
      await recordHistory(entity.id, null, app.profileId, 'entity_deleted', 'Entité supprimée')
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  function kindLabel(value: Kind): string {
    return KINDS.find((k) => k.value === value)?.label ?? value
  }
</script>

<Modal title={entity ? 'Modifier' : 'Nouvelle entité'} {onclose}>
  <form onsubmit={submit}>
    {#if entity}
      <div class="row" style="margin-bottom:14px">
        <EntityPhoto entityId={entity.id} photoPath={entity.photo_path} kind={entity.kind} alt={entity.name} />
        {#if entity.photo_path}
          <button
            type="button"
            class="btn btn-sm btn-danger"
            onclick={async () => {
              const updated = await removeEntityPhoto(entity)
              await recordHistory(entity.id, null, app.profileId, 'photo_updated', 'Photo supprimée')
              onclose()
              onsaved?.(updated)
            }}>Retirer la photo</button
          >
        {/if}
      </div>
    {/if}

    <label class="field">
      <span>Nom</span>
      <input type="text" bind:value={name} placeholder="Tondeuse, rosier, assurance habitation…" required />
    </label>

    <label class="field">
      <span>Type</span>
      <select bind:value={kind}>
        {#each KINDS as option}
          <option value={option.value}>{option.emoji} {option.label}</option>
        {/each}
      </select>
    </label>

    <label class="field">
      <span>Notes</span>
      <textarea bind:value={notes} placeholder="Modèle, emplacement, référence…"></textarea>
    </label>

    <label class="field">
      <span>Photo</span>
      <input type="file" accept="image/*" onchange={onphoto} />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <div class="form-actions">
      {#if entity}
        <button type="button" class="btn btn-danger" onclick={remove} disabled={busy}>Supprimer</button>
      {/if}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  </form>
</Modal>
