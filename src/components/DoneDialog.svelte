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
  let busy = $state(false)
  let error = $state('')

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
        created_by: app.profileId,
        updated_at: now,
        deleted_at: null
      }
      const updated: ActionRow = {
        ...action,
        last_done: doneOn,
        next_due: nextDue,
        notified_for: null,
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

    <label class="field">
      <span>Date</span>
      <input type="date" bind:value={doneOn} required />
    </label>

    <label class="field">
      <span>Commentaire</span>
      <textarea bind:value={comment} placeholder="Produit utilisé, état constaté…"></textarea>
    </label>

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
