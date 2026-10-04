<script lang="ts">
  /** The fact sheet at the side of an entity page. Empty values are skipped. */
  let { title, rows, class: cls = "" }: { title?: string; rows: Array<{ label: string; value: string | number | null | undefined; mono?: boolean; href?: string }>; class?: string } = $props();
  const shown = $derived(rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== ""));
</script>

<section class="card {cls}">
  {#if title}<h2 class="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>{/if}
  <dl class="px-4 py-2">
    {#each shown as r}
      <div class="flex items-baseline justify-between gap-4 py-1.5 text-[14px]">
        <dt class="shrink-0 text-ink-muted">{r.label}</dt>
        <dd class="min-w-0 text-right {r.mono ? 'num' : ''} font-medium text-ink">{#if r.href}<a href={r.href}>{r.value}</a>{:else}{r.value}{/if}</dd>
      </div>
    {/each}
  </dl>
</section>
