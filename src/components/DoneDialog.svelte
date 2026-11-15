<script lang="ts">
  import { app } from '../lib/state.svelte'
  import { saveLocal } from '../lib/db'
  import { addInterval, formatShort, nextAnnualDue, todayISO } from '../lib/dates'
  import type { ActionRow, LogRow } from '../lib/types'
  import Modal from './Modal.svelte'

  let {
    action,
    entityName,
    onclose
  }: { action: ActionRow; entityName: string; onclose: () => void } = $props()

  let doneOn = $state(todayISO())
  let comment = $state('')
  let cost = $state<number | null>(null)
  let checked = $state<string[]>([])
  let busy = $state(false)
  let error = $state('')

  function toggleItem(item: string) {
    checked = checked.includes(item)
      ? checked.filter((value) => value !== item)
      : [...checked, item]
  }

  const nextDue = $derived(
    doneOn
      ? action.annual_dates?.length
        ? nextAnnualDue(action.annual_dates, doneOn, false)
        : addInterval(doneOn, action.interval_value, action.interval_unit)
      : ''
  )

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = ''
    try {
      const now = new Date().toISOString()
      const log: LogRow = {
        id: crypto.randomUUID(),
        action_id: action.id,
        done_on: doneOn,
        comment: comment.trim(),
        cost: cost === null || Number.isNaN(cost) ? null : cost,
        checklist_done: checked,
        created_by: app.profileId,
        updated_at: now,
        deleted_at: null
      }
      const updated: ActionRow = {
        ...action,
        last_done: doneOn,
        next_due: nextDue,
        notified_for: null,
        last_notified_on: null,
        updated_at: now
      }
      await saveLocal('logs', log)
      await saveLocal('actions', updated)
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<Modal title="Noter une réalisation" {onclose}>
  <form onsubmit={submit}>
    <p class="muted" style="margin-bottom:12px">{entityName} · {action.label}</p>
    {#if action.description}<p class="muted tiny" style="margin:-6px 0 12px">{action.description}</p>{/if}

    <label class="field">
      <span>Date</span>
      <input type="date" bind:value={doneOn} required />
    </label>

    <label class="field">
      <span>Commentaire</span>
      <textarea bind:value={comment} placeholder="Produit utilisé, état constaté…"></textarea>
    </label>

    <label class="field">
      <span>Coût (€)</span>
      <input type="number" min="0" step="0.01" bind:value={cost} />
    </label>

    {#if action.checklist?.length}
      <div class="field">
        <span>Checklist</span>
        {#each action.checklist as item (item)}
          <label class="toggle" style="padding:6px 0">
            <span>{item}</span>
            <input type="checkbox" checked={checked.includes(item)} onchange={() => toggleItem(item)} />
          </label>
        {/each}
      </div>
    {/if}

    {#if nextDue}
      <p class="notice">Prochaine échéance : {formatShort(nextDue)}</p>
    {/if}

    {#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}

    <div class="form-actions">
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {busy ? 'Enregistrement…' : "C'est fait"}
      </button>
    </div>
  </form>
</Modal>
