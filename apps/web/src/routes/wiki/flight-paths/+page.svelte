<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { coord } from "$lib/wiki-format";
  let { data } = $props();
</script>

<svelte:head><title>Flight paths · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Classic Era" title="Flight paths" lede="Every flight master's stop the client lists, with where it stands." />
<form class="mb-4 flex flex-wrap items-center gap-2">
  <input name="q" value={data.q} type="search" placeholder="Filter by name" class="field w-full sm:w-56" />
  <button class="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] font-medium hover:bg-surface-2">Apply</button>
  <span class="ml-auto text-[13px] text-ink-muted"><span class="num">{data.rows.length}</span> stop{data.rows.length === 1 ? "" : "s"}</span>
</form>
{#if data.rows.length}
  <div class="card overflow-x-auto">
    <table class="tbl">
      <thead><tr><th>Stop</th><th>Zone</th><th>Coordinates</th></tr></thead>
      <tbody>
        {#each data.rows as n (n.entity_id)}
          <tr><td class="font-medium">{n.name}</td><td>{#if n.map_id !== null}<a href="/wiki/{data.flavor}/zone/{n.map_id}" class="text-ink-muted hover:text-ink">{n.zone ?? `Map ${n.map_id}`}</a>{/if}</td><td class="num text-ink-muted">{coord(n.x, n.y)}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <Empty text={data.q ? "No stops match." : "No flight paths recorded yet."} />
{/if}
