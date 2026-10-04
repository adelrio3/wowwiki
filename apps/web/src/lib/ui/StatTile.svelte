<script lang="ts">
  let { value, label, hint }: { value: string | number; label: string; hint?: string } = $props();
</script>

<div class="card px-4 py-3">
  <div class="num text-[26px] font-medium leading-tight text-ink">{value}</div>
  <div class="text-[13px] text-ink-muted">{label}</div>
  {#if hint}<div class="text-xs text-ink-faint">{hint}</div>{/if}
</div>
