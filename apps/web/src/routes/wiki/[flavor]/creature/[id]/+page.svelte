<script lang="ts">
  import Chip from "$lib/ui/Chip.svelte";
  import Evidence from "$lib/ui/Evidence.svelte";
  import Infobox from "$lib/ui/Infobox.svelte";
  import MapImage from "$lib/ui/MapImage.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import ItemIcon from "$lib/ui/ItemIcon.svelte";
  import { CLASSIFICATION_LABEL, ROLE_LABEL, coord, dropRate, levelRange, money, qualityClass, reactionLabel } from "$lib/wiki-format";
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

    {#if data.starts.length || data.ends.length}
      <section>
        <h2 class="mb-3 text-[17px] font-semibold">Quests</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          {#each [{ label: "Gives", list: data.starts }, { label: "Takes", list: data.ends }] as g}
            {#if g.list.length}
              <div>
                <h3 class="eyebrow mb-1.5 px-1">{g.label}</h3>
                <ul class="card divide-y divide-line text-[14px]">
                  {#each g.list as q (q.id)}<li class="flex items-center justify-between gap-3 px-4 py-2"><a class="font-medium text-ink" href="/wiki/{data.flavor}/quest/{q.id}">{q.name}</a>{#if q.level !== null}<span class="num text-ink-faint">{q.level}</span>{/if}</li>{/each}
                </ul>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/if}

    {#if data.drops.length}
      <section>
        <h2 class="mb-1 text-[17px] font-semibold">Drops</h2>
        <p class="mb-3 text-[13px] text-ink-faint">From <span class="num text-ink-muted">{data.lootWindows}</span> loot window{data.lootWindows === 1 ? "" : "s"} players opened, empty ones included.</p>
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Item</th><th>Type</th><th class="r">Drop rate</th><th class="r">Seen</th></tr></thead>
            <tbody>
              {#each data.drops as d (d.id)}
                <tr>
                  <td>
                    <a class="name flex items-center gap-2.5" href="/wiki/{data.flavor}/item/{d.id}"><ItemIcon url={d.iconUrl} name={d.name} size={30} /><span class={qualityClass(d.quality)}>{d.name}</span></a>
                    {#if d.quest}<span class="ml-2 text-xs text-gold">Quest</span>{/if}
                    {#if d.min !== null && d.max !== null && (d.min > 1 || d.max > 1)}<span class="num ml-2 text-xs text-ink-faint">×{d.min === d.max ? d.min : `${d.min}–${d.max}`}</span>{/if}
                  </td>
                  <td class="text-ink-muted">{d.itemClass ?? ""}{#if d.subclass && d.subclass !== d.itemClass}<span class="mx-1.5 text-ink-faint">·</span>{d.subclass}{/if}</td>
                  <td class="num r">{dropRate(d.seen, d.windows)}</td>
                  <td class="num r text-ink-muted">{d.seen}<span class="text-ink-faint">&nbsp;/&nbsp;{d.windows}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    {#if data.sells.length}
      <section>
        <h2 class="mb-1 text-[17px] font-semibold">Sells</h2>
        <p class="mb-3 text-[13px] text-ink-faint">Prices as the vendor window showed them{data.repairs ? "; also repairs" : ""}.</p>
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Item</th><th>Type</th><th class="r">Price</th><th>Stock</th></tr></thead>
            <tbody>
              {#each data.sells as v (v.id)}
                <tr>
                  <td><a class="name flex items-center gap-2.5" href="/wiki/{data.flavor}/item/{v.id}"><ItemIcon url={v.iconUrl} name={v.name} size={30} /><span class={qualityClass(v.quality)}>{v.name}</span></a></td>
                  <td class="text-ink-muted">{v.itemClass ?? ""}{#if v.subclass && v.subclass !== v.itemClass}<span class="mx-1.5 text-ink-faint">·</span>{v.subclass}{/if}</td>
                  <td class="num r whitespace-nowrap">
                    {#if v.price}{#each money(v.price) as m}<span>{m.n}</span><span class="mr-1 text-ink-faint">{m.unit}</span>{/each}{#if v.stack && v.stack > 1}<span class="text-ink-faint">for {v.stack}</span>{/if}{/if}
                    {#if v.ec}{#each v.ec as c}<span class="block text-ink-muted">{c.n ?? ""} {c.i ? `item #${c.i}` : (c.name ?? "")}</span>{/each}{/if}
                  </td>
                  <td class="text-ink-muted">{v.limited !== null ? `Limited (${v.limited} seen)` : "Unlimited"}</td>
                </tr>
              {/each}
            </tbody>
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
    {#if data.pet}
      <section class="card">
        <h2 class="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">As a hunter pet</h2>
        <dl class="px-4 py-2 text-[14px]">
          <div class="flex items-baseline justify-between gap-4 py-1.5"><dt class="text-ink-muted">Family</dt><dd class="font-medium"><a href="/wiki/pets?family={encodeURIComponent(data.pet.family)}#beasts">{data.pet.family}</a></dd></div>
          <div class="flex items-baseline justify-between gap-4 py-1.5"><dt class="text-ink-muted">Tamable</dt><dd class="font-medium">{data.pet.tamed ? "Yes, seen as a pet" : data.pet.tameable ? "Yes, by Beast Lore" : "By family"}</dd></div>
          {#if data.pet.diet}<div class="flex items-baseline justify-between gap-4 py-1.5"><dt class="text-ink-muted">Eats</dt><dd class="font-medium">{data.pet.diet}</dd></div>{/if}
          {#if data.pet.skills.length}<div class="flex items-baseline justify-between gap-4 py-1.5"><dt class="text-ink-muted">Teaches</dt><dd class="text-right font-medium">{data.pet.skills.map((s) => (s.rank ? `${s.name} ${s.rank}` : s.name)).join(", ")}</dd></div>{/if}
          {#if data.pet.displayId !== null}<div class="flex items-baseline justify-between gap-4 py-1.5"><dt class="text-ink-muted">Form</dt><dd class="num font-medium"><a href="/wiki/pets#forms">#{data.pet.displayId}</a></dd></div>{/if}
        </dl>
      </section>
    {/if}
    <div class="card px-4 py-3">
      <Evidence status={data.nameStatus} contributors={data.contributors} />
      <p class="mt-2 text-xs text-ink-faint"><span class="num">{data.observations}</span> observation{data.observations === 1 ? "" : "s"} from players' game clients. Nothing is imported.</p>
    </div>
  </aside>
</div>
