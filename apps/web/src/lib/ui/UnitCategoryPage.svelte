<script lang="ts">
  import CategoryToolbar from "./CategoryToolbar.svelte";
  import PageHeader from "./PageHeader.svelte";
  import UnitList from "./UnitList.svelte";
  import type { UnitRow } from "$lib/server/wiki-lists";
  let { data }: { data: { flavor: string; q: string; type: string; sort: string; types: string[]; rows: UnitRow[]; kind: "NPC" | "Creature" } } = $props();
  const title = $derived(data.kind === "NPC" ? "NPCs" : "Creatures");
  const lede = $derived(data.kind === "NPC" ? "The people of Azeroth: vendors, trainers, guards, quest givers, and anyone else standing around a settlement." : "Beasts and monsters, as players met them in the field.");
</script>

<svelte:head><title>{title} · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Classic Era" {title} {lede} />
<CategoryToolbar q={data.q} type={data.type} sort={data.sort} types={data.types} count={data.rows.length} noun={data.kind} />
<UnitList rows={data.rows} flavor={data.flavor} emptyText={data.q || data.type ? `No ${title.toLowerCase()} match.` : `No ${title.toLowerCase()} recorded yet. Install the add-on and play.`} />
