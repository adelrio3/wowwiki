<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import UnitList from "$lib/ui/UnitList.svelte";
  let { data } = $props();
  const r = $derived(data.results);
  const total = $derived(r ? r.npcs.length + r.creatures.length + r.zones.length + r.areas.length + r.taxi.length : 0);
  const continents = $derived(Object.entries(Object.groupBy(data.zones, (z) => z.parentName ?? "Other")).sort(([a], [b]) => a.localeCompare(b)));
</script>

<svelte:head><title>{data.q ? `“${data.q}” · ` : "Zones · "}Classic Era · WoW Compendium</title></svelte:head>

{#if r}
  <PageHeader eyebrow="Search · Classic Era" title={`“${data.q}”`} lede={`${total} result${total === 1 ? "" : "s"} across NPCs, creatures, zones, areas and flight paths.`}>
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
    {#if r.areas.length || r.taxi.length}
      <section class="grid gap-6 sm:grid-cols-2">
        {#if r.areas.length}
          <div><h2 class="mb-3 text-[17px] font-semibold">Areas <span class="num text-[13px] font-normal text-ink-faint">{r.areas.length}</span></h2><ul class="card divide-y divide-line text-[14px]">{#each r.areas as a}<li class="px-4 py-2">{a.name}</li>{/each}</ul></div>
        {/if}
        {#if r.taxi.length}
          <div><h2 class="mb-3 text-[17px] font-semibold">Flight paths <span class="num text-[13px] font-normal text-ink-faint">{r.taxi.length}</span></h2><ul class="card divide-y divide-line text-[14px]">{#each r.taxi as t}<li class="px-4 py-2">{t.name}</li>{/each}</ul></div>
        {/if}
      </section>
    {/if}
  </div>
{:else}
  <PageHeader eyebrow="Classic Era" title="Zones" lede="Azeroth, one map at a time. Open a zone to see who lives there, what roams there, and where." />
  {#if data.zones.length}
    <div class="space-y-9">
      {#each continents as [continent, zones]}
        <section>
          <h2 class="mb-3 flex items-baseline gap-2 text-[17px] font-semibold">{continent} <span class="num text-[13px] font-normal text-ink-faint">{zones?.length ?? 0}</span></h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each zones ?? [] as z (z.entity_id)}
              <li>
                <a href="/wiki/{data.flavor}/zone/{z.entity_id}" class="card group block px-4 py-3.5 text-ink hover:border-line-strong hover:no-underline">
                  <div class="flex items-center justify-between gap-3">
                    <span class="serif text-[20px]">{z.name}</span>
                    <Icon name="arrow" size={16} class="text-ink-faint transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div class="mt-1.5 text-[13px] text-ink-muted"><span class="num">{z.units}</span> NPC{z.units === 1 ? "" : "s"} &amp; creatures · <span class="num">{z.areas}</span> area{z.areas === 1 ? "" : "s"}</div>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {:else}
    <Empty text="No zones yet. The first player to install the add-on and log in puts the first zone on the map." href="/sync" action="Get the add-on" />
  {/if}
{/if}
