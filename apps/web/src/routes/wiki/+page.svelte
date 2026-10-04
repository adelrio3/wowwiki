<script lang="ts">
  import UnitTable from "$lib/ui/UnitTable.svelte";
  let { data } = $props();
  const total = $derived(data.npcs.length + data.creatures.length + data.maps.length + data.areas.length + data.taxi.length);
</script>

<svelte:head><title>{data.q ? `${data.q} · ` : ""}World Wiki · WoW Compendium</title></svelte:head>

<div class="space-y-8">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <div class="text-sm text-ink-muted">Classic Era</div>
      <h1 class="text-3xl font-medium">World Wiki</h1>
    </div>
    <form class="flex gap-2">
      <input type="hidden" name="flavor" value={data.flavor} />
      <input name="q" value={data.q} type="search" placeholder="Search names" class="w-56 rounded-md border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none" />
      <button class="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink-faint">Search</button>
    </form>
  </header>

  {#if data.q}
    <p class="text-sm text-ink-muted">{total} result{total === 1 ? "" : "s"} for “{data.q}”. <a href="/wiki">Clear</a></p>
  {/if}

  <div class="grid gap-8 lg:grid-cols-[2fr_1fr]">
    <div class="min-w-0 space-y-8">
      <UnitTable rows={data.npcs} flavor={data.flavor} title="NPCs" emptyText="No NPCs match." />
      <UnitTable rows={data.creatures} flavor={data.flavor} title="Creatures" emptyText="No creatures match." />
    </div>

    <div class="space-y-8">
      <section>
        <h2 class="mb-2 text-xl font-medium">Zones <span class="num text-sm text-ink-faint">{data.maps.length}</span></h2>
        <ul class="divide-y divide-line rounded-md border border-line bg-surface text-sm">
          {#each data.maps as m}<li class="px-3 py-1.5"><a href="/wiki/{data.flavor}/zone/{m.entity_id}">{m.name}</a></li>{/each}
          {#if !data.maps.length}<li class="px-3 py-2 text-ink-muted">None yet.</li>{/if}
        </ul>
      </section>
      <section>
        <h2 class="mb-2 text-xl font-medium">Areas <span class="num text-sm text-ink-faint">{data.areas.length}</span></h2>
        <ul class="divide-y divide-line rounded-md border border-line bg-surface text-sm">
          {#each data.areas as a}<li class="flex justify-between px-3 py-1.5"><span>{a.name}</span><span class="num text-xs text-ink-faint">#{a.entity_id}</span></li>{/each}
          {#if !data.areas.length}<li class="px-3 py-2 text-ink-muted">None yet.</li>{/if}
        </ul>
      </section>
      <section>
        <h2 class="mb-2 text-xl font-medium">Flight points <span class="num text-sm text-ink-faint">{data.taxi.length}</span></h2>
        <ul class="divide-y divide-line rounded-md border border-line bg-surface text-sm">
          {#each data.taxi as t}<li class="px-3 py-1.5">{t.name}</li>{/each}
          {#if !data.taxi.length}<li class="px-3 py-2 text-ink-muted">None yet.</li>{/if}
        </ul>
      </section>
    </div>
  </div>
</div>
