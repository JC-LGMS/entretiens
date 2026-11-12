<script lang="ts">
  import { dueLabel, urgencyOf, URGENCY_LABEL } from '../lib/urgency'

  let { nextDue, detailed = false }: { nextDue: string; detailed?: boolean } = $props()
  const urgency = $derived(urgencyOf(nextDue))
  const label = $derived(detailed ? `${URGENCY_LABEL[urgency]} · ${dueLabel(nextDue)}` : dueLabel(nextDue))
</script>

<span class={`badge ${urgency}`}>{label}</span>
