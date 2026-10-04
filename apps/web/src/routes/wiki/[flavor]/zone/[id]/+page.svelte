<script lang="ts">
  import Badge from "$lib/ui/Badge.svelte";
  import Card from "$lib/ui/Card.svelte";
  import EntityHeader from "$lib/ui/EntityHeader.svelte";
  import MapPanel from "$lib/ui/MapPanel.svelte";
  import { CLASSIFICATION_LABEL } from "$lib/wiki-format";
  let { data } = $props();
  const kind = $derived(`${data.mapType ? data.mapType[0]!.toUpperCase() + data.mapType.slice(1) : "Map"} · Classic Era`);
</script>

<svelte:head><title>{data.name} · WoW Compendium</title></svelte:head>

<article class="space-y-8">
  <EntityHeader {kind} title={data.name} status={data.status}>
    {#if data.parent !== null}<a href="/wiki/{data.flavor}/zone/{data.parent}" class="text-sm">↑ Parent map</a>{/if}
  </EntityHeader>

  <div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
    <div class="space-y-8">
      <MapPanel points={data.points} title="Creatures seen in {data.name}" caption="Hover a dot for the creature; click to open it. Coordinates are percentages of the zone map." />

      <section>
        <h2 class="mb-2 text-xl font-medium">Creatures <span class="num text-sm text-ink-faint">{data.creatures.length}</span></h2>
        {#if data.creatures.length}
          <div class="overflow-x-auto rounded-md border border-line bg-surface">
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th class="px-3 py-2 font-medium">Name</th><th class="px-3 py-2 font-medium">Level</th><th class="px-3 py-2 font-medium">Type</th><th class="px-3 py-2 font-medium">Spots</th><th class="px-3 py-2 font-medium">Status</th></tr></thead>
              <tbody>
                {#each data.creatures as c}
                  <tr class="border-t border-line even:bg-surface-2/40">
                    <td class="px-3 py-1.5"><a href="/wiki/{data.flavor}/creature/{c.entity_id}">{c.name}</a>{#if c.classification && c.classification !== "normal"}<span class="ml-2 text-xs text-ink-muted">{CLASSIFICATION_LABEL[c.classification] ?? c.classification}</span>{/if}</td>
                    <td class="num px-3 py-1.5">{c.level_min === null ? "" : c.level_min === c.level_max ? c.level_min : `${c.level_min}–${c.level_max}`}</td>
                    <td class="px-3 py-1.5 text-ink-muted">{c.creature_type ?? ""}</td>
                    <td class="num px-3 py-1.5">{c.positions.length}</td>
                    <td class="px-3 py-1.5"><Badge status={c.status} /></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-sm text-ink-muted">No creature positions recorded here yet.</p>
        {/if}
      </section>
    </div>

    <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
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
