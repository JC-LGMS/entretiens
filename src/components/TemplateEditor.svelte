<script lang="ts">
  import { onMount } from 'svelte'
  import { defaultTemplates, type ActionTemplate } from '../lib/templates'
  import { loadActionTemplates, saveActionTemplates } from '../lib/templateStore'
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
    open: boolean
  }

  let { onclose }: { onclose: () => void } = $props()

  function toDraft(template: ActionTemplate, open = false): Draft {
    const { checklist, ...rest } = template
    return { ...rest, checklistText: checklist.join('\n'), open }
  }

  let drafts = $state<Draft[]>([])
  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')

  onMount(async () => {
    try {
      drafts = (await loadActionTemplates()).map((template) => toDraft(template))
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      loading = false
    }
  })

  function add() {
    drafts = [
      ...drafts,
      {
        id: crypto.randomUUID(),
        label: 'Nouveau modèle',
        description: '',
        intervalValue: 1,
        intervalUnit: 'year',
        checklistText: '',
        open: true
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
    drafts = defaultTemplates().map((template) => toDraft(template))
    error = ''
  }

  async function save() {
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
    saving = true
    error = ''
    try {
      await saveActionTemplates(templates)
      onclose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      saving = false
    }
  }
</script>

<Modal title="Modèles d’actions" {onclose}>
  <p class="muted tiny" style="margin-bottom:10px">
    Ces modèles sont communs à tous les profils et à tous les appareils synchronisés.
    Touchez un modèle pour afficher tous ses champs.
  </p>

  {#if loading}
    <p class="muted tiny">Chargement des modèles…</p>
  {:else}
    <div class="template-editor">
      {#each drafts as draft (draft.id)}
        <details class="template-draft" open={draft.open}>
          <summary class="template-summary">
            <span class="template-summary-text">
              <strong>{draft.label.trim() || 'Nouveau modèle'}</strong>
              <small class="muted">
                {draft.description.trim() || 'Aucune description'}
              </small>
            </span>
          </summary>

          <div class="template-body">
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

            <button
              type="button"
              class="btn btn-ghost btn-sm template-delete"
              onclick={() => remove(draft.id)}
            >
              <Icon name="trash" size={14} /> Supprimer ce modèle
            </button>
          </div>
        </details>
      {/each}
    </div>

    <button type="button" class="btn btn-soft btn-sm" style="margin-top:10px" onclick={add}>
      ＋ Ajouter un modèle
    </button>

    {#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}

    <div class="form-actions">
      <button type="button" class="btn" onclick={restoreDefaults}>Par défaut</button>
      <button type="button" class="btn btn-primary" onclick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  {/if}
</Modal>
