<script lang="ts">
  import { untrack } from 'svelte'
  import {
    defaultTemplates,
    loadTemplates,
    saveTemplates,
    type ActionTemplate
  } from '../lib/templates'
  import { UNITS, type IntervalUnit } from '../lib/types'
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'

  interface Draft {
    id: string
    label: string
    description: string
    intervalValue: number
    intervalUnit: IntervalUnit
    checklistText: string
  }

  let { onclose }: { onclose: () => void } = $props()

  function toDraft(template: ActionTemplate): Draft {
    const { checklist, ...rest } = template
    return { ...rest, checklistText: checklist.join('\n') }
  }

  let drafts = $state<Draft[]>(untrack(() => loadTemplates().map(toDraft)))
  let error = $state('')

  function add() {
    drafts = [
      ...drafts,
      {
        id: crypto.randomUUID(),
        label: 'Nouveau modèle',
        description: '',
        intervalValue: 1,
        intervalUnit: 'year',
        checklistText: ''
      }
    ]
  }

  function remove(id: string) {
    const draft = drafts.find((item) => item.id === id)
    if (!draft) return
    if (!confirm(`Supprimer le modèle « ${draft.label} » ?`)) return
    drafts = drafts.filter((item) => item.id !== id)
  }

  function restoreDefaults() {
    if (!confirm('Rétablir tous les modèles par défaut ? Les modifications non enregistrées seront perdues.')) {
      return
    }
    drafts = defaultTemplates().map(toDraft)
    error = ''
  }

  function save() {
    if (drafts.some((draft) => !draft.label.trim())) {
      error = 'Chaque modèle doit avoir un nom.'
      return
    }
    const templates: ActionTemplate[] = drafts.map((draft) => ({
      id: draft.id,
      label: draft.label.trim(),
      description: draft.description.trim(),
      intervalValue: Math.max(1, Math.round(Number(draft.intervalValue) || 1)),
      intervalUnit: draft.intervalUnit,
      checklist: draft.checklistText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    }))
    try {
      saveTemplates(templates)
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }
</script>

<Modal title="Modèles d’actions" {onclose}>
  <p class="muted tiny" style="margin-bottom:10px">
    Ces modèles sont enregistrés sur cet appareil. Ils préremplissent le formulaire d’action.
  </p>

  <div class="template-editor">
    {#each drafts as draft (draft.id)}
      <div class="template-draft">
        <div class="row between">
          <strong>{draft.label.trim() || 'Nouveau modèle'}</strong>
          <button
            type="button"
            class="btn btn-ghost icon-btn"
            aria-label={`Supprimer ${draft.label || 'ce modèle'}`}
            title="Supprimer"
            onclick={() => remove(draft.id)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>

        <label class="field">
          <span>Nom</span>
          <input type="text" bind:value={draft.label} placeholder="Nom du modèle" required />
        </label>

        <label class="field">
          <span>Description</span>
          <textarea bind:value={draft.description} rows="2" placeholder="Description du modèle"></textarea>
        </label>

        <div class="row wrap template-frequency">
          <label class="field">
            <span>Fréquence</span>
            <input type="number" min="1" step="1" bind:value={draft.intervalValue} />
          </label>
          <label class="field">
            <span>Unité</span>
            <select bind:value={draft.intervalUnit}>
              {#each UNITS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
        </div>

        <label class="field">
          <span>Checklist</span>
          <textarea
            bind:value={draft.checklistText}
            rows="3"
            placeholder="Un point par ligne"
          ></textarea>
        </label>
      </div>
    {/each}
  </div>

  <button type="button" class="btn btn-soft btn-sm" style="margin-top:10px" onclick={add}>
    ＋ Ajouter un modèle
  </button>

  {#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}

  <div class="form-actions">
    <button type="button" class="btn" onclick={restoreDefaults}>Par défaut</button>
    <button type="button" class="btn btn-primary" onclick={save}>Enregistrer</button>
  </div>
</Modal>
