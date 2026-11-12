<script lang="ts">
  import { CHANGELOG } from '../lib/version'
  import Modal from './Modal.svelte'

  let { onclose }: { onclose: () => void } = $props()
</script>

<Modal title="Nouveautés" {onclose}>
  <div class="stack">
    {#each CHANGELOG as entry (entry.version)}
      <div class="card card-pad">
        <div class="row between">
          <strong>Version {entry.version}</strong>
          <span class="muted tiny">{entry.date}</span>
        </div>
        <ul style="margin:8px 0 0 18px;padding:0">
          {#each entry.changes as change}
            <li>{change}</li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</Modal>
