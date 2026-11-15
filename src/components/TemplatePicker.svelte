<script lang="ts">
  import { intervalLabel } from '../lib/dates'
  import { ACTION_TEMPLATES, type ActionTemplate } from '../lib/templates'
  import Modal from './Modal.svelte'

  let {
    entityName,
    onpick,
    onclose
  }: {
    entityName: string
    onpick: (template: ActionTemplate) => void
    onclose: () => void
  } = $props()
</script>

<Modal title="Modèles d’actions" {onclose}>
  <p class="muted" style="margin-bottom:10px">
    Pour {entityName}. Choisissez un modèle pour préparer l’action, puis ajustez-la avant
    d’enregistrer.
  </p>
  <div class="profile-list">
    {#each ACTION_TEMPLATES as template (template.id)}
      <button class="profile-option" onclick={() => onpick(template)}>
        <span class="avatar">＋</span>
        <span>
          <strong>{template.label}</strong>
          <small class="muted" style="display:block;font-weight:400">
            {template.description} · {intervalLabel(template.intervalValue, template.intervalUnit)}
          </small>
        </span>
      </button>
    {/each}
  </div>
</Modal>
