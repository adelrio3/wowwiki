<script lang="ts">
  import Evidence from "$lib/ui/Evidence.svelte";
  import Infobox from "$lib/ui/Infobox.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import MapImage from "$lib/ui/MapImage.svelte";
  import UnitList from "$lib/ui/UnitList.svelte";
  import { coord, titleCase } from "$lib/wiki-format";
  let { data } = $props();
  const sections = $derived([
    { id: "npcs", label: "NPCs", n: data.npcs.length },
    { id: "creatures", label: "Creatures", n: data.creatures.length },
    { id: "areas", label: "Areas", n: data.areas.length },
    { id: "flight-paths", label: "Flight paths", n: data.taxi.length },
  ]);
</script>

<svelte:head><title>{data.name} · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader crumbs={[{ href: "/wiki", label: "Zones" }, ...(data.parentName && data.parent !== null ? [{ href: `/wiki/${data.flavor}/zone/${data.parent}`, label: data.parentName }] : []), { label: data.name }]} title={data.name}>
  <nav class="flex flex-wrap gap-1.5 pt-2" aria-label="On this page">
    {#each sections as s}
      <a href="#{s.id}" class="rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink hover:no-underline">{s.label} <span class="num text-ink-faint">{s.n}</span></a>
    {/each}
  </nav>
</PageHeader>

{#if data.art}
  <MapImage art={data.art} title="Map of {data.name}" class="mb-8" />
{/if}

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
  <div class="min-w-0 space-y-10">
    <section id="npcs" class="scroll-mt-20">
      <h2 class="mb-3 text-[17px] font-semibold">NPCs <span class="num text-[13px] font-normal text-ink-faint">{data.npcs.length}</span></h2>
      <UnitList rows={data.npcs} flavor={data.flavor} showZone={false} mapId={data.id} emptyText="No one has met an NPC here yet." />
    </section>
    <section id="creatures" class="scroll-mt-20">
      <h2 class="mb-3 text-[17px] font-semibold">Creatures <span class="num text-[13px] font-normal text-ink-faint">{data.creatures.length}</span></h2>
      <UnitList rows={data.creatures} flavor={data.flavor} showZone={false} mapId={data.id} emptyText="No creatures recorded here yet." />
    </section>
    <section id="areas" class="scroll-mt-20">
      <h2 class="mb-3 text-[17px] font-semibold">Areas <span class="num text-[13px] font-normal text-ink-faint">{data.areas.length}</span></h2>
      {#if data.areas.length}
        <ul class="grid gap-2 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
          {#each data.areas as a}<li class="card px-3.5 py-2.5">{a.name}</li>{/each}
        </ul>
      {:else}<p class="text-[14px] text-ink-muted">No areas discovered here yet.</p>{/if}
    </section>
    <section id="flight-paths" class="scroll-mt-20">
      <h2 class="mb-3 text-[17px] font-semibold">Flight paths <span class="num text-[13px] font-normal text-ink-faint">{data.taxi.length}</span></h2>
      {#if data.taxi.length}
        <ul class="card divide-y divide-line text-[14px]">
          {#each data.taxi as t}<li class="flex items-center justify-between gap-3 px-4 py-2.5"><span class="font-medium">{t.name}</span><span class="num text-ink-muted">{coord(t.x, t.y)}</span></li>{/each}
        </ul>
      {:else}<p class="text-[14px] text-ink-muted">No flight master found here yet.</p>{/if}
    </section>
  </div>

  <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
    <Infobox title="About" rows={[
      { label: "Kind", value: data.mapType ? titleCase(data.mapType) : "Map" },
      { label: "Part of", value: data.parentName, href: data.parent !== null ? `/wiki/${data.flavor}/zone/${data.parent}` : undefined },
      { label: "NPCs", value: data.npcs.length, mono: true },
      { label: "Creatures", value: data.creatures.length, mono: true },
      { label: "Areas", value: data.areas.length, mono: true },
      { label: "Map ID", value: data.id, mono: true },
    ]} />
    <div class="card px-4 py-3">
      <Evidence status={data.status} contributors={data.contributors} />
      <p class="mt-2 text-xs text-ink-faint">Everything here was seen in a player's game client. Nothing is imported.{#if data.art}{" "}The map shows the <span class="num">{data.art.pieces}</span> area{data.art.pieces === 1 ? "" : "s"} players have explored so far.{/if}</p>
    </div>
  </aside>
</div>
