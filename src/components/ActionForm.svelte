<script lang="ts">
  import { untrack } from 'svelte'
  import { app } from '../lib/state.svelte'
  import { recordHistory } from '../lib/history'
  import { saveLocal, softDelete } from '../lib/db'
  import { addInterval, formatShort, intervalLabel, isDate, todayISO } from '../lib/dates'
  import { joinSummary, describeChange } from '../lib/summary'
  import { UNITS, type ActionRow, type IntervalUnit } from '../lib/types'
  import Modal from './Modal.svelte'

  let {
    entityId,
    action,
    onclose
  }: { entityId: string; action?: ActionRow; onclose: () => void } = $props()

  const initial = untrack(() => ({
    label: action?.label ?? '',
    value: action?.interval_value ?? 1,
    unit: action?.interval_unit ?? ('month' as IntervalUnit),
    nextDue: action?.next_due ?? todayISO(),
    active: action?.active ?? true
  }))
  let label = $state(initial.label)
  let value = $state(initial.value)
  let unit = $state<IntervalUnit>(initial.unit)
  let nextDue = $state(initial.nextDue)
  let active = $state(initial.active)
  let busy = $state(false)
  let error = $state('')

  function recalc() {
    if (!action?.last_done) return
    const safe = Number.isFinite(value) && value > 0 ? Math.round(value) : 1
    nextDue = addInterval(action.last_done, safe, unit)
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!label.trim()) {
      error = 'Le libellé est obligatoire.'
      return
    }
    if (!Number.isFinite(value) || value < 1) {
      error = "L'intervalle doit être supérieur à zéro."
      return
    }
    if (!isDate(nextDue)) {
      error = "La prochaine échéance n'est pas valide."
      return
    }
    busy = true
    error = ''
    try {
      const now = new Date().toISOString()
      if (!action) {
        const row: ActionRow = {
          id: crypto.randomUUID(),
          entity_id: entityId,
          label: label.trim(),
          interval_value: Math.round(value),
          interval_unit: unit,
          last_done: null,
          next_due: nextDue,
          active: true,
          notified_for: null,
          updated_at: now,
          deleted_at: null
        }
        await saveLocal('actions', row)
        await recordHistory(entityId, row.id, app.profileId, 'action_created', `Action « ${row.label} » créée`)
      } else {
        const updated: ActionRow = {
          ...action,
          label: label.trim(),
          interval_value: Math.round(value),
          interval_unit: unit,
          next_due: nextDue,
          active,
          notified_for: nextDue === action.next_due ? action.notified_for : null,
          updated_at: now
        }
        const summary = joinSummary([
          describeChange('Libellé', action.label, updated.label),
          describeChange(
            'Intervalle',
            intervalLabel(action.interval_value, action.interval_unit),
            intervalLabel(updated.interval_value, updated.interval_unit)
          ),
          describeChange('Échéance', formatShort(action.next_due), formatShort(updated.next_due)),
          action.active !== updated.active ? (updated.active ? 'Action réactivée' : 'Action désactivée') : null
        ])
        await saveLocal('actions', updated)
        if (summary) await recordHistory(entityId, updated.id, app.profileId, 'action_updated', summary)
      }
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  async function remove() {
    if (!action) return
    if (!confirm(`Supprimer l'action « ${action.label} » ? L'historique est conservé.`)) return
    busy = true
    try {
      await softDelete('actions', action.id)
      await recordHistory(entityId, action.id, app.profileId, 'action_deleted', `Action « ${action.label} » supprimée`)
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<Modal title={action ? "Modifier l'action" : 'Nouvelle action'} {onclose}>
  <form onsubmit={submit}>
    <label class="field">
      <span>Libellé</span>
      <input type="text" bind:value={label} placeholder="Entretien, taille, vidange, document…" required />
    </label>

    <div class="row">
      <label class="field" style="flex:1">
        <span>Tous les</span>
        <input type="number" min="1" bind:value={value} required />
      </label>
      <label class="field" style="flex:1">
        <span>Unité</span>
        <select bind:value={unit}>
          {#each UNITS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <label class="field">
      <span>Prochaine échéance</span>
      <input type="date" bind:value={nextDue} required />
    </label>

    {#if action?.last_done}
      <button type="button" class="btn btn-sm" style="margin-bottom:12px" onclick={recalc}>
        Calculer depuis le {formatShort(action.last_done)}
      </button>
    {/if}

    {#if action}
      <label class="toggle">
        <span>Action active</span>
        <input type="checkbox" bind:checked={active} />
      </label>
    {/if}

    {#if error}<p class="error">{error}</p>{/if}

    <div class="form-actions">
      {#if action}
        <button type="button" class="btn btn-danger" onclick={remove} disabled={busy}>Supprimer</button>
      {/if}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  </form>
</Modal>
