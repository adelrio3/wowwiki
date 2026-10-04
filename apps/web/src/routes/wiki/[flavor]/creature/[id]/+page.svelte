<script lang="ts">
  import { CLASSIFICATION_LABEL, STATUS_CLASS, STATUS_LABEL, reactionLabel } from "$lib/wiki-format";
  let { data } = $props();
  const expansions = $derived([...new Set(data.builds.filter((b) => b.build >= data.firstBuild && b.build <= data.lastBuild).map((b) => b.expansion))]);
  const byMap = $derived(Object.entries(Object.groupBy(data.positions, (p) => p.mapName)));
</script>

<svelte:head><title>{data.name} · WoW Compendium</title></svelte:head>

<article class="space-y-6 max-w-4xl">
  <header>
    <div class="text-sm text-stone-400">Creature · Classic Era{expansions.length ? ` · ${expansions.join(", ")}` : ""}</div>
    <h1 class="text-3xl font-bold flex items-center gap-3">{data.name}
      <span class="rounded border px-1.5 py-0.5 text-xs font-normal {STATUS_CLASS[data.nameStatus]}">{STATUS_LABEL[data.nameStatus]}</span>
    </h1>
    {#if data.subtitle}<div class="text-stone-300">&lt;{data.subtitle}&gt;</div>{/if}
  </header>

  <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
    <dt class="text-stone-400">Level</dt><dd>{data.levelMin === null ? "?" : data.levelMin === data.levelMax ? data.levelMin : `${data.levelMin} – ${data.levelMax}`}{data.classification && data.classification !== "normal" ? ` (${CLASSIFICATION_LABEL[data.classification] ?? data.classification})` : ""}</dd>
    <dt class="text-stone-400">Type</dt><dd>{data.creatureType ?? "?"}{data.creatureFamily ? ` · ${data.creatureFamily}` : ""}</dd>
    {#if data.tooltipFaction}<dt class="text-stone-400">Faction</dt><dd>{data.tooltipFaction}</dd>{/if}
    {#if data.reactions.length}<dt class="text-stone-400">Reaction</dt><dd>{[...new Set(data.reactions)].map(reactionLabel).join(", ")}</dd>{/if}
    {#if data.roles.length}<dt class="text-stone-400">Roles</dt><dd>{data.roles.join(", ")}</dd>{/if}
    {#if data.health.length}<dt class="text-stone-400">Health</dt><dd>{data.health.map((h) => `lvl ${h.level}: ${h.max}`).join(" · ")}</dd>{/if}
    <dt class="text-stone-400">Observed</dt><dd>by {data.contributors} contributor{data.contributors === 1 ? "" : "s"}, builds {data.firstBuild}{data.lastBuild !== data.firstBuild ? ` – ${data.lastBuild}` : ""}</dd>
  </dl>

  <section>
    <h2 class="font-semibold mb-2">Where it was seen</h2>
    {#if !byMap.length}<p class="text-stone-500 text-sm">No positions recorded yet.</p>{/if}
    {#each byMap as [mapName, points]}
      <div class="mb-4">
        <div class="text-sm mb-1">{mapName} <span class="text-stone-500">({points?.length} spot{points?.length === 1 ? "" : "s"})</span></div>
        <svg viewBox="0 0 100 66.7" class="w-full max-w-md rounded border border-stone-800 bg-stone-900">
          {#each points ?? [] as p}
            {#if p.cluster_x !== null && p.cluster_y !== null}
              <circle cx={p.cluster_x * 100} cy={p.cluster_y * 66.7} r={1 + Math.min(3, Math.log2(1 + p.observation_count))} fill="#f5c542" fill-opacity="0.8">
                <title>{(p.cluster_x * 100).toFixed(1)}, {(p.cluster_y * 100).toFixed(1)} · {p.observation_count} sightings</title>
              </circle>
            {/if}
          {/each}
        </svg>
      </div>
    {/each}
  </section>

  <details class="text-sm">
    <summary class="cursor-pointer text-stone-400">All recorded facts ({data.facts.length})</summary>
    <table class="mt-2 w-full">
      <thead class="text-left text-stone-400"><tr><th>Field</th><th>Value</th><th>Locale</th><th>Builds</th><th>Contributors</th><th>Status</th></tr></thead>
      <tbody>
        {#each data.facts as f}
          <tr class="border-t border-stone-800"><td class="py-0.5">{f.field}</td><td>{f.value_kind === "json" ? JSON.stringify(f.value_json) : f.value_kind === "text" ? f.value_text : f.value_num}</td><td>{f.locale}</td><td>{f.first_build}{f.last_build !== f.first_build ? "–" + f.last_build : ""}</td><td>{f.contributor_count}</td><td><span class="rounded border px-1 text-[10px] {STATUS_CLASS[f.status]}">{STATUS_LABEL[f.status]}</span></td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</article>
