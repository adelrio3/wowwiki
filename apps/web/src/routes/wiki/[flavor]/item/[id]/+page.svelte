<script lang="ts">
  import Evidence from "$lib/ui/Evidence.svelte";
  import Infobox from "$lib/ui/Infobox.svelte";
  import ItemTooltip from "$lib/ui/ItemTooltip.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { BIND_LABEL, coord, dropRate, equipLabel, levelRange, money, qualityClass, qualityLabel } from "$lib/wiki-format";
  let { data } = $props();
  const typeLine = $derived([data.itemClass, data.subclass && data.subclass !== data.itemClass ? data.subclass : null].filter(Boolean).join(" · "));
  const hasSources = $derived(data.drops.length || data.sold.length || data.fished.length);
</script>

<svelte:head><title>{data.name} · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader crumbs={[{ href: "/wiki/items", label: "Items" }, { label: data.name }]} title={data.name} titleClass={qualityClass(data.quality)}>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-ink-muted">
    {#if data.quality !== null}<span class={qualityClass(data.quality)}>{qualityLabel(data.quality)}</span>{/if}
    {#if typeLine}<span>{typeLine}</span>{/if}
    {#if data.equipLoc}<span>{equipLabel(data.equipLoc)}</span>{/if}
    {#if data.itemLevel !== null}<span>Item level <span class="num text-ink">{data.itemLevel}</span></span>{/if}
    {#if data.requiredLevel}<span>Requires level <span class="num text-ink">{data.requiredLevel}</span></span>{/if}
  </div>
</PageHeader>

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
  <div class="min-w-0 space-y-10">
    <section>
      <h2 class="mb-3 text-[17px] font-semibold">As the game shows it</h2>
      <ItemTooltip name={data.name} quality={data.quality} lines={data.tooltip} iconUrl={data.iconUrl} />
    </section>

    <section>
      <h2 class="mb-3 text-[17px] font-semibold">Where to get it</h2>
      {#if !hasSources}
        <p class="text-[14px] text-ink-muted">Seen in someone's bags, but not yet dropping or for sale. Loot windows and vendor lists fill this in.</p>
      {/if}
      {#if data.drops.length}
        <h3 class="eyebrow mb-1.5 px-1">Drops from</h3>
        <div class="card mb-5 overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Source</th><th class="r">Level</th><th>Where</th><th class="r">Drop rate</th><th class="r">Seen</th></tr></thead>
            <tbody>
              {#each data.drops as d}
                <tr>
                  <td>
                    {#if d.type === "creature"}<a class="name" href="/wiki/{data.flavor}/creature/{d.id}">{d.name}</a>{:else}<span class="font-medium">{d.name}</span>{/if}
                    {#if d.quest}<span class="ml-2 text-xs text-gold">Quest</span>{/if}
                    {#if d.min !== null && d.max !== null && (d.min > 1 || d.max > 1)}<span class="num ml-2 text-xs text-ink-faint">×{d.min === d.max ? d.min : `${d.min}–${d.max}`}</span>{/if}
                  </td>
                  <td class="num r whitespace-nowrap">{levelRange(d.level_min, d.level_max)}</td>
                  <td class="text-ink-muted">{#if d.place}<a href="/wiki/{data.flavor}/zone/{d.place.map_id}" class="text-ink-muted hover:text-ink">{d.place.name}</a><span class="num ml-2 text-ink-faint">{coord(d.place.x, d.place.y)}</span>{/if}</td>
                  <td class="num r">{dropRate(d.seen, d.windows)}</td>
                  <td class="num r text-ink-muted" title="{d.seen} of {d.windows} loot windows">{d.seen}<span class="text-ink-faint">&nbsp;/&nbsp;{d.windows}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      {#if data.fished.length}
        <h3 class="eyebrow mb-1.5 px-1">Fished in</h3>
        <ul class="card mb-5 divide-y divide-line text-[14px]">
          {#each data.fished as f}
            <li class="flex items-center justify-between px-4 py-2"><a class="font-medium text-ink" href="/wiki/{data.flavor}/zone/{f.mapId}">{f.name}</a><span class="num text-ink-muted">{dropRate(f.seen, f.windows)} <span class="text-ink-faint">· {f.seen} / {f.windows} casts</span></span></li>
          {/each}
        </ul>
      {/if}
      {#if data.sold.length}
        <h3 class="eyebrow mb-1.5 px-1">Sold by</h3>
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Vendor</th><th>Where</th><th class="r">Price</th><th>Stock</th></tr></thead>
            <tbody>
              {#each data.sold as v}
                <tr>
                  <td><a class="name" href="/wiki/{data.flavor}/creature/{v.id}">{v.name}</a></td>
                  <td class="text-ink-muted">{#if v.place}<a href="/wiki/{data.flavor}/zone/{v.place.map_id}" class="text-ink-muted hover:text-ink">{v.place.name}</a><span class="num ml-2 text-ink-faint">{coord(v.place.x, v.place.y)}</span>{/if}</td>
                  <td class="num r whitespace-nowrap">
                    {#if v.price}{#each money(v.price) as m, i}{#if i > 0}<span class="mx-0.5"></span>{/if}<span>{m.n}</span><span class="text-ink-faint">{m.unit}</span>{/each}{#if v.stack && v.stack > 1}<span class="text-ink-faint"> for {v.stack}</span>{/if}{/if}
                    {#if v.ec}{#each v.ec as c}<span class="block text-ink-muted">{c.n ?? ""} {c.i ? `item #${c.i}` : (c.name ?? "")}</span>{/each}{/if}
                  </td>
                  <td class="text-ink-muted">{v.limited !== null ? `Limited (${v.limited} seen)` : "Unlimited"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

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
    <Infobox title="Item" rows={[
      { label: "Quality", value: qualityLabel(data.quality) },
      { label: "Type", value: typeLine },
      { label: "Slot", value: equipLabel(data.equipLoc) },
      { label: "Item level", value: data.itemLevel, mono: true },
      { label: "Requires level", value: data.requiredLevel || null, mono: true },
      { label: "Binding", value: data.bindType ? (BIND_LABEL[data.bindType] ?? null) : null },
      { label: "Stacks to", value: data.maxStack && data.maxStack > 1 ? data.maxStack : null, mono: true },
      { label: "Sells for", value: data.sellPrice ? money(data.sellPrice).map((m) => `${m.n}${m.unit}`).join(" ") : null, mono: true },
      { label: "Reagent", value: data.reagent ? "Crafting reagent" : null },
      { label: "Seen in", value: data.expansions.length ? `${data.expansions.join(", ")} ${data.patch}` : data.patch },
      { label: "ID", value: data.id, mono: true },
    ]} />
    <div class="card px-4 py-3">
      <Evidence status={data.nameStatus} contributors={data.contributors} />
      <p class="mt-2 text-xs text-ink-faint"><span class="num">{data.observations}</span> observation{data.observations === 1 ? "" : "s"} from players' game clients. Nothing is imported.</p>
    </div>
  </aside>
</div>
