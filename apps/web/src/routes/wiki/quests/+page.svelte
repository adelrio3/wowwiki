<script lang="ts">
  import CategoryToolbar from "$lib/ui/CategoryToolbar.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import QuestList from "$lib/ui/QuestList.svelte";
  let { data } = $props();
</script>

<svelte:head><title>Quests · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Classic Era" title="Quests" lede="Every quest players have been offered, with the text the game showed, who gives it, where, and what it pays." />
<CategoryToolbar q={data.q} type={data.zone} sort={data.sort} types={data.zones} count={data.rows.length} noun="quest" sorts={[{ value: "level", label: "Sort by level" }, { value: "name", label: "Sort by name" }, { value: "zone", label: "Sort by zone" }]} typeName="zone" typeLabel="All zones" />
<QuestList rows={data.rows} flavor={data.flavor} emptyText={data.q || data.zone ? "No quests match." : "No quests recorded yet. Install the add-on and talk to a quest giver."} />
