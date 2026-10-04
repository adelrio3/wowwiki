<script lang="ts">
  import type { Snippet } from "svelte";
  let { eyebrow, title, serif = true, lede, crumbs = [], children, aside }: { eyebrow?: string; title: string; serif?: boolean; lede?: string | null; crumbs?: Array<{ href?: string; label: string }>; children?: Snippet; aside?: Snippet } = $props();
</script>

<header class="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-5">
  <div class="min-w-0 space-y-1.5">
    {#if crumbs.length}
      <nav class="flex flex-wrap items-center gap-1 text-[13px] text-ink-muted" aria-label="Breadcrumb">
        {#each crumbs as c, i}
          {#if i > 0}<span class="text-ink-faint">/</span>{/if}
          {#if c.href}<a href={c.href} class="text-ink-muted hover:text-ink">{c.label}</a>{:else}<span>{c.label}</span>{/if}
        {/each}
      </nav>
    {:else if eyebrow}
      <div class="eyebrow">{eyebrow}</div>
    {/if}
    <h1 class="{serif ? 'serif text-[34px] sm:text-[40px]' : 'text-[28px] sm:text-[32px]'} leading-none text-ink">{title}</h1>
    {#if lede}<p class="max-w-2xl pt-1 text-[15px] text-ink-muted">{lede}</p>{/if}
    {#if children}<div class="pt-1">{@render children()}</div>{/if}
  </div>
  {#if aside}<div class="shrink-0">{@render aside()}</div>{/if}
</header>
