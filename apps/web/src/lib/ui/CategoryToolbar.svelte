<script lang="ts">
  /** Filter row above a category table: search within, type, sort. Plain GET form. */
  let { q, type, sort, types, count, noun }: { q: string; type: string; sort: string; types: string[]; count: number; noun: string } = $props();
</script>

<form class="mb-4 flex flex-wrap items-center gap-2">
  <input name="q" value={q} type="search" placeholder="Filter by name" class="field w-full sm:w-56" />
  {#if types.length}
    <select name="type" class="field w-auto">
      <option value="">All types</option>
      {#each types as t}<option value={t} selected={t === type}>{t}</option>{/each}
    </select>
  {/if}
  <select name="sort" class="field w-auto">
    <option value="name" selected={sort === "name"}>Sort by name</option>
    <option value="level" selected={sort === "level"}>Sort by level</option>
    <option value="type" selected={sort === "type"}>Sort by type</option>
  </select>
  <button class="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] font-medium hover:bg-surface-2">Apply</button>
  <span class="ml-auto text-[13px] text-ink-muted"><span class="num">{count}</span> {noun}{count === 1 ? "" : "s"}</span>
</form>
