<script lang="ts">
  import { getPhotoBlob } from '../lib/photos'
  import { KINDS, type Kind } from '../lib/types'

  let {
    entityId,
    photoPath,
    kind,
    alt,
    zoomable = false
  }: { entityId: string; photoPath: string | null; kind: Kind; alt: string; zoomable?: boolean } =
    $props()

  let url = $state<string | null>(null)
  let zoom = $state(false)
  const emoji = $derived(KINDS.find((k) => k.value === kind)?.emoji ?? '📦')

  $effect(() => {
    const id = entityId
    const path = photoPath
    let cancelled = false
    let made: string | null = null
    url = null
    zoom = false

    void getPhotoBlob(id, path).then((blob) => {
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
    if (url) zoom = true
  }

  function close() {
    zoom = false
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }
</script>

<svelte:window {onkeydown} />

{#if zoomable && url}
  <button
    type="button"
    class="thumb thumb-button"
    onclick={open}
    aria-label={`Agrandir la photo : ${alt}`}
  >
    <img src={url} {alt} />
  </button>
{:else}
  <div class="thumb">
    {#if url}
      <img src={url} {alt} />
    {:else}
      <span aria-hidden="true">{emoji}</span>
    {/if}
  </div>
{/if}

{#if zoom && url}
  <div class="lightbox" role="dialog" aria-modal="true" aria-label={alt}>
    <button class="lightbox-backdrop" aria-label="Fermer" onclick={close}></button>
    <img src={url} {alt} />
    <button class="btn icon-btn lightbox-close" aria-label="Fermer" onclick={close}>✕</button>
  </div>
{/if}
