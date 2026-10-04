<script lang="ts">
  import { STATUS_CLASS, STATUS_LABEL } from "$lib/wiki-format";
  let { data } = $props();
</script>

<svelte:head><title>{data.name} · WoW Compendium</title></svelte:head>

<article class="space-y-6 max-w-4xl">
  <header>
    <div class="text-sm text-stone-400">{data.mapType ?? "Map"} · Classic Era{#if data.parent !== null} · <a href="/wiki/{data.flavor}/zone/{data.parent}">parent map</a>{/if}</div>
    <h1 class="text-3xl font-bold">{data.name}</h1>
  </header>

  <section>
    <h2 class="font-semibold mb-2">Creatures seen here</h2>
    <svg viewBox="0 0 100 66.7" class="w-full max-w-xl rounded border border-stone-800 bg-stone-900">
      {#each data.creatures as c}
        {#each c.positions as p}
          {#if p.cluster_x !== null && p.cluster_y !== null}
            <circle cx={p.cluster_x * 100} cy={p.cluster_y * 66.7} r="1" fill="#f5c542" fill-opacity="0.7"><title>{c.name}</title></circle>
          {/if}
        {/each}
      {/each}
    </svg>
    <ul class="mt-3 columns-2 md:columns-3 text-sm space-y-1">
      {#each data.creatures as c}
        <li class="flex items-center gap-2"><a href="/wiki/{data.flavor}/creature/{c.entity_id}">{c.name}</a><span class="rounded border px-1 text-[10px] {STATUS_CLASS[c.status]}">{STATUS_LABEL[c.status]}</span></li>
      {/each}
      {#if !data.creatures.length}<li class="text-stone-500">None recorded yet.</li>{/if}
    </ul>
  </section>

  <section>
    <h2 class="font-semibold mb-2">Areas</h2>
    <ul class="columns-2 md:columns-3 text-sm space-y-1">
      {#each data.areas as a}<li>{a.name} <span class="text-stone-500 text-xs">#{a.entity_id}</span></li>{/each}
      {#if !data.areas.length}<li class="text-stone-500">None recorded yet.</li>{/if}
    </ul>
  </section>
</article>
