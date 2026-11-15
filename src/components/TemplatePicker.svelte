<script lang="ts">
  import { app } from '../lib/state.svelte'
  import { saveLocal } from '../lib/db'
  import { recordHistory } from '../lib/history'
  import { addInterval, todayISO } from '../lib/dates'
  import { ACTION_TEMPLATES, type ActionTemplate } from '../lib/templates'
  import type { ActionRow } from '../lib/types'
  import Modal from './Modal.svelte'

  let {
    entityId,
    entityName,
    onclose
  }: { entityId: string; entityName: string; onclose: () => void } = $props()

  let busy = $state(false)
  let error = $state('')

  async function create(template: ActionTemplate) {
    busy = true
    error = ''
    try {
      const now = new Date().toISOString()
      const row: ActionRow = {
        id: crypto.randomUUID(),
        entity_id: entityId,
        label: template.label,
        description: template.description,
        assigned_profile_id: null,
        interval_value: template.intervalValue,
        interval_unit: template.intervalUnit,
        last_done: null,
        next_due: addInterval(todayISO(), template.intervalValue, template.intervalUnit),
        active: true,
        archived: false,
        annual_dates: [],
        notify_lead_days: 0,
        overdue_repeat_days: 0,
        last_notified_on: null,
        checklist: template.checklist,
        notified_for: null,
        updated_at: now,
        deleted_at: null
      }
      await saveLocal('actions', row)
      await recordHistory(
        entityId,
        row.id,
        app.profileId,
        'action_created',
        `Action « ${row.label} » créée depuis un modèle`
      )
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<Modal title="Modèles d’actions" {onclose}>
  <p class="muted" style="margin-bottom:10px">Pour {entityName}. Un clic crée l’action.</p>
  <div class="profile-list">
    {#each ACTION_TEMPLATES as template (template.id)}
      <button class="profile-option" disabled={busy} onclick={() => create(template)}>
        <span class="avatar">＋</span>
        <span>
          <strong>{template.label}</strong>
          <small class="muted" style="display:block;font-weight:400">
            {template.description} · tous les {template.intervalValue} {template.intervalUnit === 'year' ? 'an(s)' : 'mois'}
          </small>
        </span>
      </button>
    {/each}
  </div>
  {#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}
</Modal>
