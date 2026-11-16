<script lang="ts">
  import { onMount } from 'svelte'
  import { intervalLabel } from '../lib/dates'
  import type { ActionTemplate } from '../lib/templates'
  import { loadActionTemplates } from '../lib/templateStore'
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

  let templates = $state<ActionTemplate[]>([])
  let loading = $state(true)

  onMount(async () => {
    try {
      templates = await loadActionTemplates()
    } finally {
      loading = false
    }
  })
</script>

<Modal title="Modèles d’actions" {onclose}>
  <p class="muted" style="margin-bottom:10px">
    Pour {entityName}. Choisissez un modèle pour préparer l’action, puis ajustez-la avant
    d’enregistrer.
  </p>
  {#if loading}
    <p class="muted tiny">Chargement des modèles…</p>
  {:else if templates.length === 0}
    <p class="muted tiny">
      Aucun modèle disponible. Ajoutez-en depuis Réglages &gt; Modèles d’actions.
    </p>
  {:else}
    <div class="profile-list">
      {#each templates as template (template.id)}
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
  {/if}
</Modal>
