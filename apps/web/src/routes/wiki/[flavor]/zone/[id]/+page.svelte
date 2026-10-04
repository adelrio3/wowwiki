<script lang="ts">
  import Card from "$lib/ui/Card.svelte";
  import EntityHeader from "$lib/ui/EntityHeader.svelte";
  import MapPanel from "$lib/ui/MapPanel.svelte";
  import UnitTable from "$lib/ui/UnitTable.svelte";
  let { data } = $props();
  const kind = $derived(`${data.mapType ? data.mapType[0]!.toUpperCase() + data.mapType.slice(1) : "Map"} · Classic Era`);
</script>

<svelte:head><title>{data.name} · WoW Compendium</title></svelte:head>

<article class="space-y-8">
  <EntityHeader crumbs={[{ href: "/wiki", label: "World Wiki" }, { label: "Classic Era" }, { href: "/wiki", label: "Zones" }]} {kind} title={data.name} status={data.status}>
    {#if data.parent !== null}<a href="/wiki/{data.flavor}/zone/{data.parent}" class="text-sm">↑ Parent map</a>{/if}
  </EntityHeader>

  <div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
    <div class="min-w-0 space-y-8">
      <MapPanel points={data.points} title="NPCs and creatures seen in {data.name}" caption="Hover a dot for the name; click to open it. Coordinates are percentages of the zone map." />

      <UnitTable rows={data.npcs} flavor={data.flavor} title="NPCs" emptyText="No NPC positions recorded here yet." showSpots />
      <UnitTable rows={data.creatures} flavor={data.flavor} title="Creatures" emptyText="No creature positions recorded here yet." showSpots />
    </div>

    <aside class="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
      <Card title="Areas">
        <ul class="space-y-1 text-sm">
          {#each data.areas as a}<li class="flex justify-between gap-2"><span>{a.name}</span><span class="num text-xs text-ink-faint">#{a.entity_id}</span></li>{/each}
          {#if !data.areas.length}<li class="text-ink-muted">None recorded yet.</li>{/if}
        </ul>
      </Card>
      <Card title="Flight points">
        <ul class="space-y-1 text-sm">
          {#each data.taxi as t}<li class="flex justify-between gap-2"><span>{t.name}</span>{#if t.x !== null && t.y !== null}<span class="num text-xs text-ink-faint">{(t.x * 100).toFixed(0)}, {(t.y * 100).toFixed(0)}</span>{/if}</li>{/each}
          {#if !data.taxi.length}<li class="text-ink-muted">None recorded yet.</li>{/if}
        </ul>
      </Card>
    </aside>
  </div>
</article>
