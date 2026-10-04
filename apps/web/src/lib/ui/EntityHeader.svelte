<script lang="ts">
  import Badge from "./Badge.svelte";
  import type { Snippet } from "svelte";
  let { kind, title, status, subtitle, children }: { kind: string; title: string; status?: string; subtitle?: string | null; children?: Snippet } = $props();
</script>

<header class="space-y-1">
  <div class="text-sm text-ink-muted">{kind}</div>
  <h1 class="text-3xl font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
    <span>{title}</span>
    {#if status}<Badge {status} class="translate-y-px" />{/if}
  </h1>
  {#if subtitle}<div class="text-ink-muted">&lt;{subtitle}&gt;</div>{/if}
  {#if children}<div class="pt-1">{@render children()}</div>{/if}
</header>
