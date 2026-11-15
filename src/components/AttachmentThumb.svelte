<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { getAttachmentBlob } from '../lib/attachments'
  import type { AttachmentRow } from '../lib/types'

  let { attachment }: { attachment: AttachmentRow } = $props()
  let url = $state<string | null>(null)
  let image = $derived(attachment.mime_type.startsWith('image/'))

  $effect(() => {
    let cancelled = false
    let made: string | null = null
    url = null
    void getAttachmentBlob(attachment).then((blob) => {
      if (cancelled || !blob) return
      made = URL.createObjectURL(blob)
      url = made
    })
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  })
</script>

{#if url}
  <a href={url} target="_blank" rel="noreferrer" class="attachment-preview" title={attachment.title}>
    {#if image}
      <img src={url} alt={attachment.title} />
    {:else}
      <span aria-hidden="true">📄</span>
      <span class="tiny">{attachment.title}</span>
    {/if}
  </a>
{:else}
  <div class="attachment-preview">
    <span aria-hidden="true">{image ? '🖼️' : '📄'}</span>
    <span class="tiny">{attachment.title}</span>
  </div>
{/if}
