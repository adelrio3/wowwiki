<script lang="ts">
  /** Filter row above a category table: search within, type, sort. Plain GET form. */
  import type { Snippet } from "svelte";
  let { q, type, sort, types, count, noun, sorts = [{ value: "name", label: "Sort by name" }, { value: "level", label: "Sort by level" }, { value: "type", label: "Sort by type" }], children }: { q: string; type: string; sort: string; types: string[]; count: number; noun: string; sorts?: Array<{ value: string; label: string }>; children?: Snippet } = $props();
</script>

<form class="mb-4 flex flex-wrap items-center gap-2">
  <input name="q" value={q} type="search" placeholder="Filter by name" class="field w-full sm:w-56" />
  {#if types.length}
    <select name="type" class="field w-auto">
      <option value="">All types</option>
      {#each types as t}<option value={t} selected={t === type}>{t}</option>{/each}
    </select>
  {/if}
  {#if children}{@render children()}{/if}
  <select name="sort" class="field w-auto">
    {#each sorts as s}<option value={s.value} selected={s.value === sort}>{s.label}</option>{/each}
  </select>
  <button class="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] font-medium hover:bg-surface-2">Apply</button>
  <span class="ml-auto text-[13px] text-ink-muted"><span class="num">{count}</span> {noun}{count === 1 ? "" : "s"}</span>
</form>
