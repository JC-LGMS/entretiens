<script lang="ts">
  import { untrack } from 'svelte'
  import { liveQuery } from 'dexie'
  import { app } from '../lib/state.svelte'
  import { recordHistory } from '../lib/history'
  import { db, saveLocal, softDelete } from '../lib/db'
  import {
    addInterval,
    annualDatesLabel,
    formatShort,
    intervalLabel,
    isDate,
    nextAnnualDue,
    todayISO
  } from '../lib/dates'
  import { joinSummary, describeChange } from '../lib/summary'
  import type { ActionTemplate } from '../lib/templates'
  import { UNITS, type ActionRow, type IntervalUnit, type ProfileRow } from '../lib/types'
  import AttachmentList from './AttachmentList.svelte'
  import Modal from './Modal.svelte'

  let {
    entityId,
    entityName,
    action,
    template,
    onclose
  }: {
    entityId: string
    entityName?: string
    action?: ActionRow
    template?: ActionTemplate
    onclose: () => void
  } = $props()

  type Mode = 'interval' | 'annual'

  const initial = untrack(() => ({
    label: action?.label ?? template?.label ?? '',
    description: action?.description ?? template?.description ?? '',
    value: action?.interval_value ?? template?.intervalValue ?? 1,
    unit: action?.interval_unit ?? template?.intervalUnit ?? ('year' as IntervalUnit),
    nextDue:
      action?.next_due ??
      (template
        ? addInterval(todayISO(), template.intervalValue, template.intervalUnit)
        : todayISO()),
    active: action?.active ?? true,
    mode: (action?.annual_dates?.length ? 'annual' : 'interval') as Mode,
    annualDates: [...(action?.annual_dates ?? [])],
    assigned: action?.assigned_profile_id ?? '',
    lead: action?.notify_lead_days ?? 0,
    repeat: action?.overdue_repeat_days ?? 1,
    checklist: (action?.checklist ?? template?.checklist ?? []).join('\n')
  }))
  let label = $state(initial.label)
  let description = $state(initial.description)
  let value = $state(initial.value)
  let unit = $state<IntervalUnit>(initial.unit)
  let nextDue = $state(initial.nextDue)
  let active = $state(initial.active)
  let mode = $state<Mode>(initial.mode)
  let annualDates = $state<string[]>(initial.annualDates)
  let assigned = $state(initial.assigned)
  let lead = $state(initial.lead)
  let repeat = $state(initial.repeat)
  let checklistText = $state(initial.checklist)
  let profiles = $state<ProfileRow[]>([])
  let busy = $state(false)
  let error = $state('')

  $effect(() => {
    const sub = liveQuery(() =>
      db.profiles.filter((profile) => !profile.deleted_at).toArray()
    ).subscribe((rows) => {
      profiles = rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    })
    return () => sub.unsubscribe()
  })

  const displayYear = new Date().getFullYear()

  function annualInputValue(md: string): string {
    const leap = new Date(displayYear, 1, 29).getMonth() === 1
    const year = md === '02-29' && !leap ? 2000 : displayYear
    return `${year}-${md}`
  }

  function defaultAnnualDates(): string[] {
    const start = todayISO()
    return [start.slice(5), addInterval(start, 6, 'month').slice(5)]
  }

  function selectMode(next: Mode) {
    mode = next
    if (next === 'annual' && annualDates.length === 0) {
      annualDates = defaultAnnualDates()
    }
  }

  const sortedAnnual = $derived([...new Set(annualDates)].sort())
  const annualNext = $derived.by(() => {
    if (mode !== 'annual' || sortedAnnual.length === 0) return ''
    return nextAnnualDue(sortedAnnual, action?.last_done ?? todayISO(), !action?.last_done)
  })
  const effectiveNext = $derived(mode === 'annual' ? annualNext : nextDue)

  function recalc() {
    if (!action?.last_done) return
    const safe = Number.isFinite(value) && value > 0 ? Math.round(value) : 1
    nextDue = addInterval(action.last_done, safe, unit)
  }

  function addAnnualDate() {
    annualDates = [...annualDates, todayISO().slice(5)]
  }

  function removeAnnualDate(index: number) {
    annualDates = annualDates.filter((_, i) => i !== index)
  }

  function setAnnualDate(index: number, value: string) {
    if (!value) return
    const md = value.slice(5)
    annualDates = annualDates.map((date, i) => (i === index ? md : date))
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!label.trim()) {
      error = 'Le libellé est obligatoire.'
      return
    }
    if (mode === 'interval' && (!Number.isFinite(value) || value < 1)) {
      error = "L'intervalle doit être supérieur à zéro."
      return
    }
    if (mode === 'annual' && sortedAnnual.length === 0) {
      error = 'Ajoutez au moins une date dans l’année.'
      return
    }
    if (!Number.isFinite(lead) || lead < 0 || !Number.isFinite(repeat) || repeat < 1) {
      error = 'Les délais de rappel doivent être positifs (relance au moins 1 jour).'
      return
    }
    if (!isDate(effectiveNext)) {
      error = "La prochaine échéance n'est pas valide."
      return
    }
    busy = true
    error = ''
    try {
      const now = new Date().toISOString()
      const intervalValue = mode === 'interval' ? Math.max(1, Math.round(value)) : 1
      const intervalUnit = mode === 'interval' ? unit : 'year'
      const repeatDays = Math.max(1, Math.round(repeat))
      const dates = mode === 'annual' ? sortedAnnual : []
      const checklist = checklistText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)

      if (!action) {
        const row: ActionRow = {
          id: crypto.randomUUID(),
          entity_id: entityId,
          label: label.trim(),
          description: description.trim(),
          assigned_profile_id: assigned || null,
          interval_value: intervalValue,
          interval_unit: intervalUnit,
          last_done: null,
          next_due: effectiveNext,
          active: true,
          archived: false,
          annual_dates: dates,
          notify_lead_days: Math.round(lead),
          overdue_repeat_days: repeatDays,
          last_notified_on: null,
          checklist,
          notified_for: null,
          updated_at: now,
          deleted_at: null
        }
        await saveLocal('actions', row)
        await recordHistory(entityId, row.id, app.profileId, 'action_created', `Action « ${row.label} » créée`)
      } else {
        const notificationChanged =
          action.notify_lead_days !== Math.round(lead) ||
          action.overdue_repeat_days !== repeatDays
        const updated: ActionRow = {
          ...action,
          label: label.trim(),
          description: description.trim(),
          assigned_profile_id: assigned || null,
          interval_value: intervalValue,
          interval_unit: intervalUnit,
          annual_dates: dates,
          next_due: effectiveNext,
          active,
          notify_lead_days: Math.round(lead),
          overdue_repeat_days: repeatDays,
          last_notified_on:
            effectiveNext !== action.next_due || notificationChanged
              ? null
              : action.last_notified_on,
          checklist,
          notified_for: effectiveNext === action.next_due ? action.notified_for : null,
          updated_at: now
        }
        const oldMode: Mode = action.annual_dates?.length ? 'annual' : 'interval'
        const summary = joinSummary([
          describeChange('Libellé', action.label, updated.label),
          describeChange('Description', action.description, updated.description),
          describeChange(
            'Assignée à',
            profiles.find((profile) => profile.id === action.assigned_profile_id)?.name ?? '',
            profiles.find((profile) => profile.id === updated.assigned_profile_id)?.name ?? ''
          ),
          oldMode !== mode ? (mode === 'annual' ? 'Mode : dates fixes' : 'Mode : intervalle') : null,
          mode === 'annual'
            ? describeChange(
                'Dates annuelles',
                oldMode === 'annual' ? annualDatesLabel(action.annual_dates) : '',
                annualDatesLabel(sortedAnnual)
              )
            : describeChange(
                'Intervalle',
                intervalLabel(action.interval_value, action.interval_unit),
                intervalLabel(updated.interval_value, updated.interval_unit)
              ),
          describeChange('Échéance', formatShort(action.next_due), formatShort(updated.next_due)),
          describeChange('Rappel avant', `${action.notify_lead_days} j`, `${updated.notify_lead_days} j`),
          describeChange('Relance retard', `${action.overdue_repeat_days} j`, `${updated.overdue_repeat_days} j`),
          JSON.stringify(action.checklist ?? []) !== JSON.stringify(updated.checklist)
            ? 'Checklist modifiée'
            : null,
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
    {#if entityName}
      <p class="notice" style="margin-bottom:12px">Entité : <strong>{entityName}</strong></p>
    {/if}

    <label class="field">
      <span>Libellé</span>
      <input type="text" bind:value={label} placeholder="Entretien, taille, vidange, document…" required />
    </label>

    <label class="field">
      <span>Description</span>
      <textarea bind:value={description} placeholder="Détails, produit, référence…"></textarea>
    </label>

    <label class="field">
      <span>Assignée à</span>
      <select bind:value={assigned}>
        <option value="">Personne</option>
        {#each profiles as profile (profile.id)}
          <option value={profile.id}>{profile.name}</option>
        {/each}
      </select>
    </label>

    <div class="row">
      <label class="field" style="flex:1">
        <span>Prévenir avant (jours)</span>
        <input type="number" min="0" bind:value={lead} />
      </label>
      <label class="field" style="flex:1">
        <span>Relancer retard (jours)</span>
        <input type="number" min="1" bind:value={repeat} />
      </label>
    </div>

    <label class="field">
      <span>Checklist (une ligne par élément)</span>
      <textarea bind:value={checklistText} placeholder="Huile&#10;Filtre&#10;Niveaux"></textarea>
    </label>

    <div class="chips" style="margin-bottom:12px">
      <button type="button" class="chip" class:active={mode === 'interval'} onclick={() => selectMode('interval')}>
        Intervalle
      </button>
      <button type="button" class="chip" class:active={mode === 'annual'} onclick={() => selectMode('annual')}>
        Dates fixes
      </button>
    </div>

    {#if mode === 'interval'}
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
    {:else}
      <div class="field">
        <span>Dates dans l'année</span>
        {#each annualDates as md, index (index)}
          <div class="row" style="margin-bottom:6px">
            <input
              type="date"
              value={annualInputValue(md)}
              oninput={(event) => setAnnualDate(index, event.currentTarget.value)}
            />
            <button
              type="button"
              class="btn icon-btn"
              aria-label="Retirer cette date"
              onclick={() => removeAnnualDate(index)}
            >
              ✕
            </button>
          </div>
        {/each}
        <button type="button" class="btn btn-sm" onclick={addAnnualDate}>+ Ajouter une date</button>
      </div>
      {#if annualNext}
        <p class="notice" style="margin-bottom:12px">
          Prochaine échéance : {formatShort(annualNext)}
        </p>
      {/if}
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

  {#if action}
    <div class="section-title" style="margin-top:16px"><h2>Photos</h2></div>
    <p class="muted tiny" style="margin-bottom:8px">
      Cliquez sur une photo pour l’agrandir. Le titre s’affiche sous la photo.
    </p>
    <AttachmentList
      ownerType="action"
      ownerId={action.id}
      accept="image/*"
      label="Ajouter une photo"
      emptyLabel="Aucune photo pour cette action."
    />
  {:else}
    <p class="muted tiny" style="margin-top:12px">
      Enregistrez l’action pour pouvoir ajouter des photos.
    </p>
  {/if}
</Modal>
