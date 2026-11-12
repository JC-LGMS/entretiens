<script lang="ts">
  import { getPhotoBlob } from '../lib/photos'
  import { KINDS, type Kind } from '../lib/types'

  let {
    entityId,
    photoPath,
    kind,
    alt
  }: { entityId: string; photoPath: string | null; kind: Kind; alt: string } = $props()

  let url = $state<string | null>(null)
  const emoji = $derived(KINDS.find((k) => k.value === kind)?.emoji ?? '📦')

  $effect(() => {
    const id = entityId
    const path = photoPath
    let cancelled = false
    let made: string | null = null
    url = null

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
</script>

<div class="thumb">
  {#if url}
    <img src={url} {alt} />
  {:else}
    <span aria-hidden="true">{emoji}</span>
  {/if}
</div>
