<script lang="ts">
  import CategoryToolbar from "$lib/ui/CategoryToolbar.svelte";
  import ItemList from "$lib/ui/ItemList.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { qualityLabel } from "$lib/wiki-format";
  let { data } = $props();
</script>

<svelte:head><title>Items · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Classic Era" title="Items" lede="Everything players have looted, bought or carried, with the tooltip the game showed and where each one came from." />
<CategoryToolbar q={data.q} type={data.type} sort={data.sort} types={data.types} count={data.rows.length} noun="item" sorts={[{ value: "name", label: "Sort by name" }, { value: "level", label: "Sort by item level" }, { value: "quality", label: "Sort by quality" }, { value: "type", label: "Sort by type" }]}>
  {#if data.qualities.length}
    <select name="quality" class="field w-auto">
      <option value="">All qualities</option>
      {#each data.qualities as q}<option value={q} selected={String(q) === data.quality}>{qualityLabel(q)}</option>{/each}
    </select>
  {/if}
</CategoryToolbar>
<ItemList rows={data.rows} flavor={data.flavor} emptyText={data.q || data.type || data.quality ? "No items match." : "No items recorded yet. Install the add-on and open a loot window."} />
