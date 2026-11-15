<script lang="ts">
  import { untrack } from 'svelte'
  import { saveLocal } from '../lib/db'
  import { recalculateAction } from '../lib/actions'
  import { formatShort } from '../lib/dates'
  import type { LogRow } from '../lib/types'
  import Modal from './Modal.svelte'

  let {
    log,
    onclose
  }: { log: LogRow; onclose: () => void } = $props()

  const initial = untrack(() => ({
    doneOn: log.done_on,
    comment: log.comment,
    cost: log.cost
  }))
  let doneOn = $state(initial.doneOn)
  let comment = $state(initial.comment)
  let cost = $state<number | null>(initial.cost)
  let busy = $state(false)
  let error = $state('')

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = ''
    try {
      await saveLocal('logs', {
        ...log,
        done_on: doneOn,
        comment: comment.trim(),
        cost: typeof cost === 'number' && Number.isFinite(cost) ? cost : null,
        updated_at: new Date().toISOString()
      })
      await recalculateAction(log.action_id)
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<Modal title="Modifier la réalisation" {onclose}>
  <form onsubmit={submit}>
    <p class="muted" style="margin-bottom:12px">{formatShort(log.done_on)}</p>
    <label class="field">
      <span>Date</span>
      <input type="date" bind:value={doneOn} required />
    </label>
    <label class="field">
      <span>Commentaire</span>
      <textarea bind:value={comment}></textarea>
    </label>
    <label class="field">
      <span>Coût (€)</span>
      <input type="number" min="0" step="0.01" bind:value={cost} />
    </label>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="form-actions">
      <button class="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  </form>
</Modal>
