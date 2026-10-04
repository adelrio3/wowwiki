<script lang="ts">
  import Badge from "./Badge.svelte";
  import type { Snippet } from "svelte";
  let { crumbs = [], kind, title, status, subtitle, children }: { crumbs?: Array<{ href?: string; label: string }>; kind: string; title: string; status?: string; subtitle?: string | null; children?: Snippet } = $props();
</script>

<header class="space-y-2">
  {#if crumbs.length}
    <nav class="text-sm text-ink-muted" aria-label="Breadcrumb">
      {#each crumbs as c, i}
        {#if i > 0}<span class="mx-1.5 text-ink-faint">/</span>{/if}
        {#if c.href}<a href={c.href}>{c.label}</a>{:else}<span>{c.label}</span>{/if}
      {/each}
    </nav>
  {/if}
  <div class="text-sm font-medium text-ink-muted">{kind}</div>
  <h1 class="flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl">
    <span>{title}</span>
    {#if status}<Badge {status} class="translate-y-0.5" />{/if}
  </h1>
  {#if subtitle}<div class="text-ink-muted">&lt;{subtitle}&gt;</div>{/if}
  {#if children}<div class="pt-1">{@render children()}</div>{/if}
</header>
