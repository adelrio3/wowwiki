<script lang="ts">
  import Chip from "$lib/ui/Chip.svelte";
  import Evidence from "$lib/ui/Evidence.svelte";
  import Infobox from "$lib/ui/Infobox.svelte";
  import MapImage from "$lib/ui/MapImage.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { CLASSIFICATION_LABEL, ROLE_LABEL, coord, levelRange, reactionLabel } from "$lib/wiki-format";
  let { data } = $props();
  const cls = $derived(data.classification && data.classification !== "normal" ? CLASSIFICATION_LABEL[data.classification] ?? data.classification : null);
  const home = $derived(data.locations[0]?.mapName ?? null);
  const category = $derived(data.kind === "NPC" ? { href: "/wiki/npcs", label: "NPCs" } : { href: "/wiki/creatures", label: "Creatures" });
</script>

<svelte:head><title>{data.name} · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader crumbs={[category, ...(home && data.locations[0] ? [{ href: `/wiki/${data.flavor}/zone/${data.locations[0].mapId}`, label: home }] : []), { label: data.name }]} title={data.name}>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-ink-muted">
    {#if data.subtitle}<span class="serif text-[17px] text-ink">&lt;{data.subtitle}&gt;</span>{/if}
    <span>Level <span class="num text-ink">{levelRange(data.levelMin, data.levelMax) || "?"}</span>{#if cls}<span class="ml-1.5 text-gold">{cls}</span>{/if}</span>
    {#if data.creatureType}<span>{data.creatureType}{#if data.creatureFamily}<span class="mx-1.5 text-ink-faint">·</span>{data.creatureFamily}{/if}</span>{/if}
  </div>
  {#if data.roles.length}
    <div class="flex flex-wrap gap-1.5 pt-2.5">
      {#each data.roles as r}<Chip tone="gold">{ROLE_LABEL[r] ?? r}</Chip>{/each}
    </div>
  {/if}
</PageHeader>

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
  <div class="min-w-0 space-y-10">
    <section>
      <h2 class="mb-3 text-[17px] font-semibold">Where to find {data.kind === "NPC" ? "them" : "it"}</h2>
      {#if data.homeArt && data.locations[0]}
        <MapImage art={data.homeArt} title="{data.name} in {data.locations[0].mapName}" pins={data.locations[0].spots.map((s) => ({ x: s.x, y: s.y, label: `${coord(s.x, s.y)} · ${s.n} sighting${s.n === 1 ? "" : "s"}`, weight: s.n }))} class="mb-4" />
      {/if}
      {#if data.locations.length}
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Zone</th><th>Coordinates</th><th class="r">Sightings</th></tr></thead>
            <tbody>
              {#each data.locations as l}
                <tr>
                  <td><a class="name" href="/wiki/{data.flavor}/zone/{l.mapId}">{l.mapName}</a></td>
                  <td class="num text-ink-muted">{#each l.spots as s, i}{#if i > 0}<span class="mx-1.5 text-ink-faint">·</span>{/if}<span title="{s.n} sighting{s.n === 1 ? '' : 's'}">{coord(s.x, s.y)}</span>{/each}</td>
                  <td class="num r text-ink-muted">{l.sightings}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-xs text-ink-faint">Coordinates are the ones the game shows, out of 100. The first is where {data.kind === "NPC" ? "they were" : "it was"} seen most.</p>
      {:else}
        <p class="text-[14px] text-ink-muted">Seen, but no position was recorded yet.</p>
      {/if}
    </section>

    {#if data.health.length}
      <section>
        <h2 class="mb-3 text-[17px] font-semibold">Health</h2>
        <div class="card inline-block min-w-[16rem] overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Level</th><th class="r">Max health</th></tr></thead>
            <tbody>{#each data.health as h}<tr><td class="num">{h.level}</td><td class="num r">{h.max.toLocaleString()}</td></tr>{/each}</tbody>
          </table>
        </div>
      </section>
    {/if}

    <details class="group">
      <summary class="text-[14px] text-ink-muted hover:text-ink">Every recorded fact <span class="num">({data.facts.length})</span></summary>
      <div class="card mt-3 overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>Field</th><th>Value</th><th>Locale</th><th>Builds</th><th class="r">Players</th><th>Status</th></tr></thead>
          <tbody>
            {#each data.facts as f}
              <tr>
                <td class="mono text-[13px]">{f.field}</td>
                <td class="num">{f.value_kind === "json" ? JSON.stringify(f.value_json) : f.value_kind === "text" ? f.value_text : f.value_num}</td>
                <td class="text-ink-muted">{f.locale}</td>
                <td class="num">{f.first_build}{f.last_build !== f.first_build ? `–${f.last_build}` : ""}</td>
                <td class="num r">{f.contributor_count}</td>
                <td class="text-ink-muted">{f.status}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  </div>

  <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
    <Infobox title={data.kind} rows={[
      { label: "Level", value: `${levelRange(data.levelMin, data.levelMax) || "?"}${cls ? ` ${cls}` : ""}`, mono: true },
      { label: "Type", value: data.creatureType },
      { label: "Family", value: data.creatureFamily },
      { label: "Faction", value: data.tooltipFaction ?? data.factionGroup },
      { label: "Reaction", value: data.reactions.length ? data.reactions.map(reactionLabel).join(", ") : null },
      { label: "PvP", value: data.pvp ? "Flagged" : null },
      { label: "Seen in", value: data.expansions.length ? `${data.expansions.join(", ")} ${data.patch}` : data.patch },
      { label: "ID", value: data.id, mono: true },
    ]} />
    <div class="card px-4 py-3">
      <Evidence status={data.nameStatus} contributors={data.contributors} />
      <p class="mt-2 text-xs text-ink-faint"><span class="num">{data.observations}</span> observation{data.observations === 1 ? "" : "s"} from players' game clients. Nothing is imported.</p>
    </div>
  </aside>
</div>
