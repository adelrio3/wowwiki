<script lang="ts">
  import { STATUS_CLASS, STATUS_LABEL } from "$lib/wiki-format";
  let { data } = $props();
</script>

<section class="space-y-6">
  <div class="flex items-end justify-between gap-4 flex-wrap">
    <h1 class="text-2xl font-bold">World Wiki <span class="text-stone-400 text-base font-normal">· Classic Era</span></h1>
    <form class="flex gap-2">
      <input type="hidden" name="flavor" value={data.flavor} />
      <input name="q" value={data.q} placeholder="Search names" class="rounded border border-stone-700 bg-stone-900 px-3 py-1.5 text-sm" />
      <button class="rounded border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-500">Search</button>
    </form>
  </div>

  <div class="grid gap-8 md:grid-cols-3">
    <div>
      <h2 class="font-semibold mb-2">Zones</h2>
      <ul class="space-y-1 text-sm">
        {#each data.maps as m}<li><a href="/wiki/{data.flavor}/zone/{m.entity_id}">{m.name}</a></li>{/each}
        {#if !data.maps.length}<li class="text-stone-500">None observed yet.</li>{/if}
      </ul>
    </div>
    <div>
      <h2 class="font-semibold mb-2">Creatures</h2>
      <ul class="space-y-1 text-sm">
        {#each data.creatures as c}
          <li class="flex items-center gap-2"><a href="/wiki/{data.flavor}/creature/{c.entity_id}">{c.name}</a><span class="rounded border px-1 text-[10px] {STATUS_CLASS[c.status]}">{STATUS_LABEL[c.status]}</span></li>
        {/each}
        {#if !data.creatures.length}<li class="text-stone-500">None observed yet.</li>{/if}
      </ul>
    </div>
    <div>
      <h2 class="font-semibold mb-2">Areas</h2>
      <ul class="space-y-1 text-sm">
        {#each data.areas as a}<li>{a.name} <span class="text-stone-500 text-xs">#{a.entity_id}</span></li>{/each}
        {#if !data.areas.length}<li class="text-stone-500">None observed yet.</li>{/if}
      </ul>
    </div>
  </div>
</section>
