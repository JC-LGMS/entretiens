<script lang="ts">
  import { onMount } from 'svelte'
  import { getAttachmentBlob } from '../lib/attachments'
  import type { AttachmentRow } from '../lib/types'

  let { attachment }: { attachment: AttachmentRow } = $props()
  let url = $state<string | null>(null)
  let zoom = $state(false)
  let pushed = false
  const image = $derived(attachment.mime_type.startsWith('image/'))

  onMount(() => {
    const onPopState = () => {
      if (zoom) {
        zoom = false
        pushed = false
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  })

  $effect(() => {
    let cancelled = false
    let made: string | null = null
    url = null
    zoom = false
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

  function open() {
    if (!url || zoom) return
    zoom = true
    history.pushState({ lightbox: true }, '', location.href)
    pushed = true
  }

  function close() {
    if (!zoom) return
    zoom = false
    if (pushed) {
      pushed = false
      history.back()
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }
</script>

<svelte:window {onkeydown} />

{#if url && image}
  <button
    type="button"
    class="attachment-preview attachment-button"
    onclick={open}
    aria-label={`Agrandir : ${attachment.title}`}
    title={attachment.title}
  >
    <img src={url} alt={attachment.title} />
  </button>
{:else if url}
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    class="attachment-preview"
    title={attachment.title}
    aria-label={`Ouvrir : ${attachment.title}`}
  >
    <span aria-hidden="true">📄</span>
  </a>
{:else}
  <div class="attachment-preview">
    <span aria-hidden="true">{image ? '🖼️' : '📄'}</span>
  </div>
{/if}

<span class="attachment-title" title={attachment.title}>{attachment.title}</span>

{#if zoom && url}
  <div class="lightbox" role="dialog" aria-modal="true" aria-label={attachment.title}>
    <button class="lightbox-backdrop" aria-label="Fermer" onclick={close}></button>
    <figure class="lightbox-figure">
      <img src={url} alt={attachment.title} />
      <figcaption class="lightbox-caption">{attachment.title}</figcaption>
    </figure>
    <button class="btn icon-btn lightbox-close" aria-label="Fermer" onclick={close}>✕</button>
  </div>
{/if}
