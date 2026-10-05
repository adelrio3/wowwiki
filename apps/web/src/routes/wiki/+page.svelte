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
  // A zone whose parent is the world map rather than a continent is a battleground (Classic Era: Alterac Valley, Arathi Basin, Warsong Gulch).
  const isZone = (z: (typeof data.zones)[number]) => z.mapType !== 2 && z.mapType !== 1 && z.mapType !== 0;
  const parentOf = (z: (typeof data.zones)[number]) => data.zones.find((p) => p.entity_id === z.parent);
  const battlegrounds = $derived(data.zones.filter((z) => isZone(z) && parentOf(z)?.mapType === 1).sort((a, b) => a.name.localeCompare(b.name)));
  // Zones of a continent, top to bottom then left to right as they sit on its map, so the list reads like the map.
  const zonesOf = (continentId: number) => data.zones.filter((z) => isZone(z) && z.parent === continentId).sort((a, b) => ((a.bounds?.y ?? 9) + (a.bounds?.h ?? 0) / 2) - ((b.bounds?.y ?? 9) + (b.bounds?.h ?? 0) / 2) || (a.bounds?.x ?? 9) - (b.bounds?.x ?? 9) || a.name.localeCompare(b.name));
  const regionsOf = (continentId: number) => zonesOf(continentId).filter((z) => z.bounds).map((z) => ({ id: z.entity_id, name: z.name, href: `/wiki/${data.flavor}/zone/${z.entity_id}`, ...z.bounds!, recorded: z.status !== "unrecorded" }));
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
  <PageHeader eyebrow="Classic Era" title="Zones" lede="Click a zone on the map, or pick it from the list. Each list reads top to bottom as the zones sit on the continent.">
    <nav class="flex flex-wrap gap-1.5 pt-2" aria-label="Continents">
      {#each data.continents as c (c.entity_id)}<a href="#continent-{c.entity_id}" class="rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink hover:no-underline">{c.name}</a>{/each}
      {#if battlegrounds.length}<a href="#battlegrounds" class="rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink hover:no-underline">Battlegrounds</a>{/if}
    </nav>
  </PageHeader>
  {#if data.zones.length}
    <div class="space-y-12">
      {#each data.continents as c (c.entity_id)}
        {@const art = data.continentArt[c.entity_id]}
        {@const list = zonesOf(c.entity_id)}
        <section id="continent-{c.entity_id}" class="scroll-mt-20">
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <h2 class="serif text-[26px]"><a href="/wiki/{data.flavor}/zone/{c.entity_id}" class="text-ink hover:text-accent">{c.name}</a></h2>
            <span class="text-[13px] text-ink-faint"><span class="num">{list.length}</span> zones · <span class="num">{list.filter((z) => z.status !== "unrecorded").length}</span> recorded</span>
          </div>
          <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]">
            {#if art}
              <ZoneMap {art} title="Map of {c.name}" regions={regionsOf(c.entity_id)} class="self-start" />
            {:else}
              <div class="card grid min-h-40 place-items-center text-[14px] text-ink-muted">The map of {c.name} is being assembled. Reload in a moment.</div>
            {/if}
            <ul class="card divide-y divide-line self-start text-[14px]">
              {#each list as z (z.entity_id)}
                <li>
                  <a href="/wiki/{data.flavor}/zone/{z.entity_id}" class="flex items-center justify-between gap-3 px-4 py-2 text-ink hover:bg-surface-2 hover:no-underline">
                    <span class="font-medium">{z.name}</span>
                    <span class="text-[12px] text-ink-faint">{#if z.units || z.areas}<span class="num">{z.units}</span> NPCs &amp; creatures · <span class="num">{z.areas}</span> areas{:else}not recorded yet{/if}</span>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        </section>
      {/each}
      {#if battlegrounds.length}
        <section id="battlegrounds" class="scroll-mt-20">
          <h2 class="serif mb-3 text-[26px]">Battlegrounds</h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each battlegrounds as z (z.entity_id)}
              <li><a href="/wiki/{data.flavor}/zone/{z.entity_id}" class="card group block px-4 py-3.5 text-ink hover:border-line-strong hover:no-underline"><div class="flex items-center justify-between gap-3"><span class="serif text-[20px]">{z.name}</span><Icon name="arrow" size={16} class="text-ink-faint transition-transform group-hover:translate-x-0.5" /></div><div class="mt-1.5 text-[13px] text-ink-muted">{#if z.units || z.areas}<span class="num">{z.units}</span> NPCs &amp; creatures · <span class="num">{z.areas}</span> areas{:else}<span class="text-ink-faint">Nothing recorded here yet</span>{/if}</div></a></li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {:else}
    <Empty text="No zones yet. The first player to install the add-on and log in puts the first zone on the map." href="/sync" action="Get the add-on" />
  {/if}
{/if}
