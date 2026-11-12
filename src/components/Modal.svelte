<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    title,
    onclose,
    children
  }: { title: string; onclose: () => void; children: Snippet } = $props()

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose()
  }
</script>

<svelte:window {onkeydown} />

<div class="modal-backdrop">
  <button class="modal-backdrop-close" aria-label="Fermer" onclick={onclose}></button>
  <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
    <div class="modal-head">
      <h2>{title}</h2>
      <button class="btn btn-ghost icon-btn" aria-label="Fermer" onclick={onclose}>✕</button>
    </div>
    {@render children()}
  </div>
</div>
