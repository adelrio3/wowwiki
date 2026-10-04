<script lang="ts">
  let { value, label, hint }: { value: string | number; label: string; hint?: string } = $props();
</script>

<div class="rounded-md border border-line bg-surface px-4 py-3">
  <div class="num text-2xl font-medium leading-tight">{value}</div>
  <div class="text-sm text-ink-muted">{label}</div>
  {#if hint}<div class="text-xs text-ink-faint">{hint}</div>{/if}
</div>
