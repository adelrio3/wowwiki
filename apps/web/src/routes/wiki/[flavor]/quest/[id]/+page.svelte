<script lang="ts">
  import Evidence from "$lib/ui/Evidence.svelte";
  import Infobox from "$lib/ui/Infobox.svelte";
  import ItemIcon from "$lib/ui/ItemIcon.svelte";
  import MapImage from "$lib/ui/MapImage.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { coord, money, qualityClass } from "$lib/wiki-format";
  let { data } = $props();
  const paragraphs = (t: string | null) => (t ? t.split(/\n{2,}|\\n\\n/).map((p) => p.replace(/\\n/g, " ").trim()).filter(Boolean) : []);
  const choices = $derived(data.rewards.filter((r) => r.choice));
  const given = $derived(data.rewards.filter((r) => !r.choice));
</script>

<svelte:head><title>{data.name} · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader crumbs={[{ href: "/wiki/quests", label: "Quests" }, ...(data.startMap !== null ? [{ href: `/wiki/${data.flavor}/zone/${data.startMap}`, label: data.startMapName ?? "" }] : []), { label: data.name }]} title={data.name}>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-ink-muted">
    {#if data.level !== null}<span>Level <span class="num text-ink">{data.level}</span></span>{/if}
    {#if data.suggestedGroup}<span>Group of <span class="num text-ink">{data.suggestedGroup}</span></span>{/if}
    {#if data.header}<span>{data.header}</span>{/if}
    {#if data.frequency === 2}<span class="text-gold">Daily</span>{:else if data.frequency === 3}<span class="text-gold">Weekly</span>{/if}
  </div>
</PageHeader>

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
  <div class="min-w-0 space-y-10">
    <section>
      <h2 class="mb-3 text-[17px] font-semibold">The quest</h2>
      <div class="card px-5 py-4">
        {#if data.description}
          <div class="space-y-3 text-[15px] leading-relaxed">
            {#each paragraphs(data.description) as p}<p>{p}</p>{/each}
          </div>
        {:else}
          <p class="text-[14px] text-ink-muted">The quest text has not been recorded yet.</p>
        {/if}
        {#if data.objectives.length || data.objectivesText}
          <h3 class="eyebrow mt-5 mb-1.5">Objectives</h3>
          {#if data.objectivesText}<p class="mb-2 text-[14px] text-ink-muted">{data.objectivesText}</p>{/if}
          {#if data.objectives.length}
            <ul class="space-y-1 text-[14px]">
              {#each data.objectives as o}<li class="flex items-baseline gap-2"><span class="text-ink-faint" aria-hidden="true">–</span><span>{o.text}{#if o.n && o.n > 1}<span class="num ml-1.5 text-ink-faint">0/{o.n}</span>{/if}</span></li>{/each}
            </ul>
          {/if}
        {/if}
        {#if data.requires.length || data.requiredMoney}
          <h3 class="eyebrow mt-5 mb-1.5">Hand in</h3>
          <ul class="space-y-1 text-[14px]">
            {#each data.requires as r (r.id)}<li class="flex items-center gap-2"><ItemIcon url={r.iconUrl} name={r.name} size={24} /><a href="/wiki/{data.flavor}/item/{r.id}" class={qualityClass(r.quality)}>{r.name}</a>{#if r.n > 1}<span class="num text-ink-faint">×{r.n}</span>{/if}</li>{/each}
            {#if data.requiredMoney}<li class="num text-ink-muted">{#each money(data.requiredMoney) as m}{m.n}<span class="mr-1 text-ink-faint">{m.unit}</span>{/each}</li>{/if}
          </ul>
        {/if}
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-[17px] font-semibold">Rewards</h2>
      {#if data.rewards.length || data.xp || data.money}
        <div class="card px-5 py-4 text-[14px]">
          {#if choices.length}
            <h3 class="eyebrow mb-1.5">Choose one</h3>
            <ul class="mb-4 grid gap-1.5 sm:grid-cols-2">
              {#each choices as r (r.id)}<li class="flex items-center gap-2.5"><ItemIcon url={r.iconUrl} name={r.name} size={30} /><span><a href="/wiki/{data.flavor}/item/{r.id}" class="font-medium {qualityClass(r.quality)}">{r.name}</a>{#if r.n > 1}<span class="num ml-1.5 text-ink-faint">×{r.n}</span>{/if}<span class="block text-[12px] text-ink-faint">{r.itemClass ?? ""}{r.subclass && r.subclass !== r.itemClass ? ` · ${r.subclass}` : ""}</span></span></li>{/each}
            </ul>
          {/if}
          {#if given.length}
            <h3 class="eyebrow mb-1.5">You will receive</h3>
            <ul class="mb-4 grid gap-1.5 sm:grid-cols-2">
              {#each given as r (r.id)}<li class="flex items-center gap-2.5"><ItemIcon url={r.iconUrl} name={r.name} size={30} /><span><a href="/wiki/{data.flavor}/item/{r.id}" class="font-medium {qualityClass(r.quality)}">{r.name}</a>{#if r.n > 1}<span class="num ml-1.5 text-ink-faint">×{r.n}</span>{/if}</span></li>{/each}
            </ul>
          {/if}
          {#if data.xp || data.money}
            <p class="text-ink-muted">
              {#if data.xp}<span class="num text-ink">{data.xp.toLocaleString()}</span> experience{/if}
              {#if data.xp && data.money}<span class="mx-1.5 text-ink-faint">·</span>{/if}
              {#if data.money}<span class="num text-ink">{#each money(data.money) as m}{m.n}<span class="mr-1 text-ink-faint">{m.unit}</span>{/each}</span>{/if}
            </p>
          {/if}
        </div>
      {:else}
        <p class="text-[14px] text-ink-muted">No reward recorded yet.</p>
      {/if}
    </section>

    <section>
      <h2 class="mb-3 text-[17px] font-semibold">Where it starts and ends</h2>
      {#if data.art && data.giverSpot}
        <MapImage art={data.art} title="Where {data.name} is given, in {data.startMapName}" pins={[{ x: data.giverSpot.x, y: data.giverSpot.y, label: `Quest giver · ${coord(data.giverSpot.x, data.giverSpot.y)}`, weight: 1 }]} class="mb-4" />
      {/if}
      <div class="card overflow-x-auto">
        <table class="tbl">
          <thead><tr><th></th><th>Who</th><th>Where</th></tr></thead>
          <tbody>
            {#each data.givers as g}<tr><td class="text-ink-muted">Given by</td><td><a class="name" href="/wiki/{data.flavor}/creature/{g.id}">{g.name}</a></td><td class="text-ink-muted">{#if g.place}<a href="/wiki/{data.flavor}/zone/{g.place.map_id}" class="text-ink-muted hover:text-ink">{g.place.name}</a><span class="num ml-2 text-ink-faint">{coord(g.place.x, g.place.y)}</span>{/if}</td></tr>{/each}
            {#if data.itemStarted && !data.givers.length}<tr><td class="text-ink-muted">Given by</td><td>An item</td><td></td></tr>{/if}
            {#each data.enders as g}<tr><td class="text-ink-muted">Turned in to</td><td><a class="name" href="/wiki/{data.flavor}/creature/{g.id}">{g.name}</a></td><td class="text-ink-muted">{#if g.place}<a href="/wiki/{data.flavor}/zone/{g.place.map_id}" class="text-ink-muted hover:text-ink">{g.place.name}</a><span class="num ml-2 text-ink-faint">{coord(g.place.x, g.place.y)}</span>{/if}</td></tr>{/each}
            {#if !data.givers.length && !data.enders.length && !data.itemStarted}<tr><td colspan="3" class="text-ink-muted">Seen in a quest log, not yet at a quest giver.</td></tr>{/if}
          </tbody>
        </table>
      </div>
    </section>

    {#if data.progressText || data.completionText}
      <details class="group">
        <summary class="text-[14px] text-ink-muted hover:text-ink">What they say on the way</summary>
        <div class="card mt-3 space-y-3 px-5 py-4 text-[14px]">
          {#if data.progressText}<div><div class="eyebrow mb-1">Before it is done</div>{#each paragraphs(data.progressText) as p}<p>{p}</p>{/each}</div>{/if}
          {#if data.completionText}<div><div class="eyebrow mb-1">On completion</div>{#each paragraphs(data.completionText) as p}<p>{p}</p>{/each}</div>{/if}
        </div>
      </details>
    {/if}

    <details class="group">
      <summary class="text-[14px] text-ink-muted hover:text-ink">Every recorded fact <span class="num">({data.facts.length})</span></summary>
      <div class="card mt-3 overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>Field</th><th>Value</th><th>Locale</th><th>Builds</th><th class="r">Players</th><th>Status</th></tr></thead>
          <tbody>
            {#each data.facts as f}
              <tr><td class="mono text-[13px]">{f.field}</td><td class="num">{f.value_kind === "json" ? JSON.stringify(f.value_json) : f.value_kind === "text" ? f.value_text : f.value_num}</td><td class="text-ink-muted">{f.locale}</td><td class="num">{f.first_build}{f.last_build !== f.first_build ? `–${f.last_build}` : ""}</td><td class="num r">{f.contributor_count}</td><td class="text-ink-muted">{f.status}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  </div>

  <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
    <Infobox title="Quest" rows={[
      { label: "Level", value: data.level, mono: true },
      { label: "Log header", value: data.header },
      { label: "Starts in", value: data.startMapName, href: data.startMap !== null ? `/wiki/${data.flavor}/zone/${data.startMap}` : undefined },
      { label: "Experience", value: data.xp ? data.xp.toLocaleString() : null, mono: true },
      { label: "Money", value: data.money ? money(data.money).map((m) => `${m.n}${m.unit}`).join(" ") : null, mono: true },
      { label: "Seen in", value: data.expansions.length ? `${data.expansions.join(", ")} ${data.patch}` : data.patch },
      { label: "ID", value: data.id, mono: true },
    ]} />
    <div class="card px-4 py-3">
      <Evidence status={data.nameStatus} contributors={data.contributors} />
      <p class="mt-2 text-xs text-ink-faint"><span class="num">{data.observations}</span> observation{data.observations === 1 ? "" : "s"} from players' game clients. Nothing is imported.</p>
    </div>
  </aside>
</div>
