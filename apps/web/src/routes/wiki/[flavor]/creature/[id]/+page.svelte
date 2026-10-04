<script lang="ts">
  import Badge from "$lib/ui/Badge.svelte";
  import Card from "$lib/ui/Card.svelte";
  import EntityHeader from "$lib/ui/EntityHeader.svelte";
  import FactList from "$lib/ui/FactList.svelte";
  import MapPanel from "$lib/ui/MapPanel.svelte";
  import { CLASSIFICATION_LABEL, reactionLabel } from "$lib/wiki-format";
  let { data } = $props();
  const level = $derived(data.levelMin === null ? "?" : data.levelMin === data.levelMax ? String(data.levelMin) : `${data.levelMin}–${data.levelMax}`);
  const cls = $derived(data.classification && data.classification !== "normal" ? CLASSIFICATION_LABEL[data.classification] ?? data.classification : null);
  const kind = $derived(`Creature · Level ${level}${cls ? ` ${cls}` : ""}${data.creatureType ? ` · ${data.creatureType}` : ""}`);
  const roleLabel: Record<string, string> = { gossip: "Talks", quest: "Quest giver", quest_end: "Quest turn-in", vendor: "Vendor", trainer: "Trainer", taxi: "Flight master", bank: "Banker", innkeeper: "Innkeeper", stable_master: "Stable master", auctioneer: "Auctioneer", mailbox: "Mail", spirit_healer: "Spirit healer", battlemaster: "Battlemaster", guild_bank: "Guild bank", guild_registrar: "Guild registrar", tabard_vendor: "Tabard vendor", petition_vendor: "Petition vendor" };
</script>

<svelte:head><title>{data.name} · WoW Compendium</title></svelte:head>

<article class="grid gap-8 lg:grid-cols-[1fr_20rem]">
  <div class="space-y-8">
    <EntityHeader {kind} title={data.name} status={data.nameStatus} subtitle={data.subtitle}>
      {#if data.roles.length}
        <div class="flex flex-wrap gap-1.5">
          {#each data.roles as r}<span class="rounded-sm border border-line bg-surface px-2 py-0.5 text-xs">{roleLabel[r] ?? r}</span>{/each}
        </div>
      {/if}
    </EntityHeader>

    <Card title="Facts">
      <FactList items={[
        { label: "Level", value: `${level}${cls ? ` (${cls})` : ""}`, mono: true },
        { label: "Type", value: data.creatureType ? `${data.creatureType}${data.creatureFamily ? ` · ${data.creatureFamily}` : ""}` : null },
        { label: "Faction", value: data.tooltipFaction ?? data.factionGroup },
        { label: "Reaction", value: data.reactions.length ? data.reactions.map(reactionLabel).join(", ") : null },
        { label: "PvP", value: data.pvp ? "Flagged" : null },
      ]} />
      {#if data.health.length}
        <div class="mt-4">
          <div class="mb-1 text-xs uppercase tracking-wide text-ink-muted">Health by level</div>
          <table class="text-sm">
            <tbody>
              {#each data.health as h}<tr><td class="num pr-6 text-ink-muted">lvl {h.level}</td><td class="num">{h.max.toLocaleString()}</td></tr>{/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>

    <section class="space-y-4">
      <h2 class="text-xl font-medium">Where it was seen</h2>
      {#if !data.byMap.length}
        <p class="text-sm text-ink-muted">No positions recorded yet.</p>
      {/if}
      {#each data.byMap as m}
        <MapPanel points={m.points} title={m.mapName} caption="Coordinates are percentages of the zone map, as the game shows them. Larger dots were seen more often." />
        <div class="-mt-2 text-sm"><a href="/wiki/{data.flavor}/zone/{m.mapId}">All creatures in {m.mapName} →</a></div>
      {/each}
    </section>

    <details class="group rounded-md border border-line bg-surface">
      <summary class="cursor-pointer px-4 py-2.5 text-sm text-ink-muted">All recorded facts <span class="num">({data.facts.length})</span></summary>
      <div class="overflow-x-auto border-t border-line">
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th class="px-3 py-2 font-medium">Field</th><th class="px-3 py-2 font-medium">Value</th><th class="px-3 py-2 font-medium">Locale</th><th class="px-3 py-2 font-medium">Builds</th><th class="px-3 py-2 font-medium">Contributors</th><th class="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody>
            {#each data.facts as f}
              <tr class="border-t border-line even:bg-surface-2/40">
                <td class="px-3 py-1">{f.field}</td>
                <td class="num px-3 py-1">{f.value_kind === "json" ? JSON.stringify(f.value_json) : f.value_kind === "text" ? f.value_text : f.value_num}</td>
                <td class="px-3 py-1 text-ink-muted">{f.locale}</td>
                <td class="num px-3 py-1">{f.first_build}{f.last_build !== f.first_build ? `–${f.last_build}` : ""}</td>
                <td class="num px-3 py-1">{f.contributor_count}</td>
                <td class="px-3 py-1"><Badge status={f.status} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  </div>

  <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
    <Card title="Provenance">
      <FactList items={[
        { label: "Contributors", value: data.contributors, mono: true },
        { label: "Observations", value: data.observations, mono: true },
        { label: "Builds", value: data.firstBuild === data.lastBuild ? String(data.firstBuild) : `${data.firstBuild}–${data.lastBuild}`, mono: true },
        { label: "Expansion", value: data.expansions.join(", ") || "Classic" },
        { label: "ID", value: data.id, mono: true },
      ]} />
      <p class="mt-3 text-xs text-ink-faint">Everything on this page was seen in a player's game client. Nothing is imported.</p>
    </Card>
  </aside>
</article>
