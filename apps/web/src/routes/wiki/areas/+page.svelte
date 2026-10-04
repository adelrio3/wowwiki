<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  let { data } = $props();
</script>

<svelte:head><title>Areas · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Classic Era" title="Areas" lede="Named places inside zones: villages, camps, ravines, and the rest of what the game announces as you discover it." />
<form class="mb-4 flex flex-wrap items-center gap-2">
  <input name="q" value={data.q} type="search" placeholder="Filter by name" class="field w-full sm:w-56" />
  <button class="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] font-medium hover:bg-surface-2">Apply</button>
  <span class="ml-auto text-[13px] text-ink-muted"><span class="num">{data.rows.length}</span> area{data.rows.length === 1 ? "" : "s"}</span>
</form>
{#if data.rows.length}
  <div class="card overflow-x-auto">
    <table class="tbl">
      <thead><tr><th>Area</th><th>Zone</th></tr></thead>
      <tbody>
        {#each data.rows as a (a.entity_id)}
          <tr><td class="font-medium">{a.name}</td><td>{#if a.map_id !== null}<a href="/wiki/{data.flavor}/zone/{a.map_id}" class="text-ink-muted hover:text-ink">{a.zone ?? `Map ${a.map_id}`}</a>{/if}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <Empty text={data.q ? "No areas match." : "No areas discovered yet."} />
{/if}
