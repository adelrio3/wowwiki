<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import UnitList from "$lib/ui/UnitList.svelte";
  import ZoneMap from "$lib/ui/ZoneMap.svelte";
  let { data } = $props();
  const r = $derived(data.results);
  const total = $derived(r ? r.npcs.length + r.creatures.length + r.zones.length + r.areas.length : 0);
  // Zones (type 3) grouped under their continent; continents themselves get a card at the top of their group.
  // Battlegrounds sit under the world map rather than a continent (Classic Era: Alterac Valley, Arathi Basin, Warsong Gulch).
  const isZone = (z: (typeof data.zones)[number]) => z.mapType !== 2 && z.mapType !== 1 && z.mapType !== 0;
  const battlegrounds = $derived(data.zones.filter((z) => isZone(z) && z.parent === data.world?.entity_id).sort((a, b) => a.name.localeCompare(b.name)));
  // Zones of the open continent, top to bottom then left to right as they sit on its map.
  const zonesHere = $derived(data.continent ? data.zones.filter((z) => isZone(z) && z.parent === data.continent!.entity_id).sort((a, b) => ((a.bounds?.y ?? 9) + (a.bounds?.h ?? 0) / 2) - ((b.bounds?.y ?? 9) + (b.bounds?.h ?? 0) / 2) || (a.bounds?.x ?? 9) - (b.bounds?.x ?? 9) || a.name.localeCompare(b.name)) : []);
  const regions = $derived((data.continent ? zonesHere : data.continents).filter((z) => z.shape).map((z) => ({ id: z.entity_id, name: z.name, href: data.continent ? `/wiki/${data.flavor}/zone/${z.entity_id}` : `/wiki?continent=${z.entity_id}`, shape: z.shape! })));
  let hover = $state<number | null>(null);
  const counts = (z: (typeof data.zones)[number]) => (z.units || z.areas ? `${z.units} NPCs & creatures · ${z.areas} areas` : "not recorded yet");
</script>

<svelte:head><title>{data.q ? `“${data.q}” · ` : "Zones · "}Classic Era · WoW Compendium</title></svelte:head>

{#if r}
  <PageHeader eyebrow="Search · Classic Era" title={`“${data.q}”`} lede={`${total} result${total === 1 ? "" : "s"} across NPCs, creatures, zones and areas.`}>
    <a href="/wiki" class="text-[13px]">Clear search</a>
  </PageHeader>
  {#if !total}
    <Empty text="Nothing by that name has been seen yet. Names match as players type them in the game, in English." />
  {/if}
  <div class="space-y-10">
    {#if r.zones.length}
      <section>
        <h2 class="mb-3 text-[17px] font-semibold">Zones <span class="num text-[13px] font-normal text-ink-faint">{r.zones.length}</span></h2>
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {#each r.zones as z}<li><a href="/wiki/{data.flavor}/zone/{z.entity_id}" class="card flex items-center justify-between px-4 py-3 text-ink hover:border-line-strong hover:no-underline"><span class="font-medium">{z.name}</span><Icon name="arrow" size={16} class="text-ink-faint" /></a></li>{/each}
        </ul>
      </section>
    {/if}
    {#if r.npcs.length}
      <section><h2 class="mb-3 text-[17px] font-semibold">NPCs <span class="num text-[13px] font-normal text-ink-faint">{r.npcs.length}</span></h2><UnitList rows={r.npcs} flavor={data.flavor} /></section>
    {/if}
    {#if r.creatures.length}
      <section><h2 class="mb-3 text-[17px] font-semibold">Creatures <span class="num text-[13px] font-normal text-ink-faint">{r.creatures.length}</span></h2><UnitList rows={r.creatures} flavor={data.flavor} /></section>
    {/if}
    {#if r.areas.length}
      <section><h2 class="mb-3 text-[17px] font-semibold">Areas <span class="num text-[13px] font-normal text-ink-faint">{r.areas.length}</span></h2><ul class="card divide-y divide-line text-[14px]">{#each r.areas as a}<li class="px-4 py-2">{a.name}</li>{/each}</ul></section>
    {/if}
  </div>
{:else}
  <PageHeader crumbs={data.continent ? [{ href: "/wiki", label: data.world?.name ?? "Azeroth" }, { label: data.continent.name }] : [{ label: data.world?.name ?? "Azeroth" }]} title={data.continent?.name ?? data.world?.name ?? "Zones"} lede={data.continent ? "Click a zone on the map or in the list. The list reads top to bottom as the zones sit on the map." : "Click a continent on the map or in the list, then a zone."} />
  {#if data.zones.length}
    <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]">
      {#if data.art}
        <ZoneMap art={data.art} title="Map of {data.continent?.name ?? data.world?.name ?? 'Azeroth'}" {regions} bind:hover class="self-start" />
      {:else}
        <div class="card grid min-h-40 place-items-center text-[14px] text-ink-muted">The map is being assembled. Reload in a moment.</div>
      {/if}
      <div class="space-y-4 self-start">
        {#if data.continent}
          <ul class="card divide-y divide-line text-[14px]">
            {#each zonesHere as z (z.entity_id)}
              <li>
                <a href="/wiki/{data.flavor}/zone/{z.entity_id}" class="flex items-center justify-between gap-3 px-4 py-2 text-ink hover:no-underline {hover === z.entity_id ? 'bg-gold-soft' : 'hover:bg-surface-2'}" onmouseenter={() => (hover = z.entity_id)} onmouseleave={() => (hover = null)}>
                  <span class="font-medium">{z.name}</span>
                  <span class="text-[12px] text-ink-faint">{counts(z)}</span>
                </a>
              </li>
            {/each}
          </ul>
          <a href="/wiki/{data.flavor}/zone/{data.continent.entity_id}" class="block text-[13px]">The whole of {data.continent.name} as one page →</a>
        {:else}
          <ul class="card divide-y divide-line text-[14px]">
            {#each data.continents as c (c.entity_id)}
              {@const n = data.zones.filter((z) => isZone(z) && z.parent === c.entity_id)}
              <li>
                <a href="/wiki?continent={c.entity_id}" class="flex items-center justify-between gap-3 px-4 py-2.5 text-ink hover:no-underline {hover === c.entity_id ? 'bg-gold-soft' : 'hover:bg-surface-2'}" onmouseenter={() => (hover = c.entity_id)} onmouseleave={() => (hover = null)}>
                  <span class="serif text-[18px]">{c.name}</span>
                  <span class="text-[12px] text-ink-faint"><span class="num">{n.length}</span> zones · <span class="num">{n.filter((z) => z.status !== "unrecorded").length}</span> recorded</span>
                </a>
              </li>
            {/each}
          </ul>
          {#if battlegrounds.length}
            <div>
              <h2 class="eyebrow mb-1.5 px-1">Battlegrounds</h2>
              <ul class="card divide-y divide-line text-[14px]">
                {#each battlegrounds as z (z.entity_id)}
                  <li><a href="/wiki/{data.flavor}/zone/{z.entity_id}" class="flex items-center justify-between gap-3 px-4 py-2 text-ink hover:bg-surface-2 hover:no-underline"><span class="font-medium">{z.name}</span><span class="text-[12px] text-ink-faint">{counts(z)}</span></a></li>
                {/each}
              </ul>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {:else}
    <Empty text="No zones yet. The first player to install the add-on and log in puts the first zone on the map." href="/sync" action="Get the add-on" />
  {/if}
{/if}
