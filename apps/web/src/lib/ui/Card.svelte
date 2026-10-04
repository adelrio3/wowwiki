<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, class: cls = "", pad = true, children, aside }: { title?: string; class?: string; pad?: boolean; children: Snippet; aside?: Snippet } = $props();
</script>

<section class="card overflow-hidden {cls}">
  {#if title || aside}
    <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      {#if title}<h2 class="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>{/if}
      {#if aside}{@render aside()}{/if}
    </header>
  {/if}
  <div class={pad ? "px-4 py-3.5" : ""}>{@render children()}</div>
</section>
