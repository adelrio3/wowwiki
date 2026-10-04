<script lang="ts">
  let { items }: { items: Array<{ label: string; value: string | number | null | undefined; mono?: boolean }> } = $props();
</script>

<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
  {#each items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "") as item}
    <dt class="text-ink-muted">{item.label}</dt>
    <dd class={item.mono ? "num" : ""}>{item.value}</dd>
  {/each}
</dl>
