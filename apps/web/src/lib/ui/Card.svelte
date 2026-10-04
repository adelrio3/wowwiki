<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, class: cls = "", children, aside }: { title?: string; class?: string; children: Snippet; aside?: Snippet } = $props();
</script>

<section class="rounded-md border border-line bg-surface {cls}">
  {#if title || aside}
    <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      {#if title}<h2 class="text-base font-medium">{title}</h2>{/if}
      {#if aside}{@render aside()}{/if}
    </header>
  {/if}
  <div class="px-4 py-3">{@render children()}</div>
</section>
