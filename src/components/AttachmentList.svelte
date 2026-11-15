<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { deleteAttachment, saveAttachment } from '../lib/attachments'
  import type { AttachmentOwner, AttachmentRow } from '../lib/types'
  import AttachmentThumb from './AttachmentThumb.svelte'

  let {
    ownerType,
    ownerId,
    accept = 'image/*',
    label = 'Ajouter une photo'
  }: {
    ownerType: AttachmentOwner
    ownerId: string
    accept?: string
    label?: string
  } = $props()

  let attachments = $state<AttachmentRow[]>([])
  let title = $state('')
  let file = $state<File | null>(null)
  let busy = $state(false)
  let error = $state('')

  $effect(() => {
    const type = ownerType
    const id = ownerId
    const sub = liveQuery(async () =>
      (await db.attachments.where('owner_id').equals(id).toArray())
        .filter((row) => row.owner_type === type && !row.deleted_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    ).subscribe((rows) => {
      attachments = rows
    })
    return () => sub.unsubscribe()
  })

  function onfile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    file = input.files?.[0] ?? null
  }

  async function add(event: SubmitEvent) {
    event.preventDefault()
    if (!file) {
      error = 'Choisissez un fichier.'
      return
    }
    busy = true
    error = ''
    try {
      await saveAttachment(ownerType, ownerId, file, title)
      title = ''
      file = null
      const input = document.getElementById(`file-${ownerId}`) as HTMLInputElement | null
      if (input) input.value = ''
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  async function remove(row: AttachmentRow) {
    if (!confirm(`Supprimer « ${row.title} » ?`)) return
    await deleteAttachment(row)
  }
</script>

<div class="attachment-grid">
  {#each attachments as row (row.id)}
    <div class="attachment-item">
      <AttachmentThumb attachment={row} />
      <button class="btn btn-sm btn-ghost tiny" onclick={() => remove(row)}>Supprimer</button>
    </div>
  {/each}
</div>

<form class="row wrap" style="margin-top:8px" onsubmit={add}>
  <input
    type="text"
    bind:value={title}
    placeholder="Titre (optionnel)"
    aria-label="Titre de la pièce jointe"
    style="flex:1;min-width:130px"
  />
  <input id={`file-${ownerId}`} type="file" {accept} onchange={onfile} />
  <button class="btn btn-sm btn-soft" type="submit" disabled={busy}>
    {busy ? '…' : label}
  </button>
</form>
{#if error}<p class="error" style="margin-top:8px">{error}</p>{/if}
