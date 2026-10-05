<script lang="ts">
  import Card from "$lib/ui/Card.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import StatTile from "$lib/ui/StatTile.svelte";
  import { CLASS_COLOR, played, realmName } from "$lib/journal-format";
  import { titleCase } from "$lib/wiki-format";
  let { data } = $props();
  const c = $derived(data.character);
  type Ev = (typeof data.events)[number];
  const glyph: Record<string, string> = { login: "○", logout: "●", level_up: "▲", zone_enter: "→", area_discovered: "✦", instance_enter: "⌂", death: "✕", first_sighting: "◇", loot: "◆", quest_accept: "❯", quest_complete: "✔", quest_abandon: "✘" };
  const describe = (e: Ev): string => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    switch (e.kind) {
      case "login": return `Logged in at level ${p.level}`;
      case "logout": return `Logged out at level ${p.level}`;
      case "level_up": return `Reached level ${p.level}`;
      case "zone_enter": return `Entered ${data.maps[e.map_id ?? -1] ?? p.zone ?? "a new map"}`;
      case "area_discovered": return `Discovered ${p.name}${p.xp ? ` (+${p.xp} xp)` : ""}`;
      case "instance_enter": return "Entered an instance";
      case "death": return `Died at level ${p.level}`;
      case "first_sighting": return `First saw ${p.name ?? `${p.entity_type} #${p.entity_id}`}`;
      case "quest_accept": return `Accepted ${p.title ?? `quest #${p.id}`}`;
      case "quest_complete": return `Completed ${p.title ?? `quest #${p.id}`}${p.xp ? ` (+${Number(p.xp).toLocaleString()} xp)` : ""}`;
      case "quest_abandon": return `Abandoned ${p.title ?? `quest #${p.id}`}`;
      case "loot": return `Looted ${p.name ?? `item #${p.item}`}${Number(p.n) > 1 ? ` ×${p.n}` : ""}`;
      default: return e.kind;
    }
  };
  const byDay = $derived(Object.entries(Object.groupBy(data.events, (e) => new Date(e.at).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))));
</script>

<svelte:head><title>{c.name} · Journal · WoW Compendium</title></svelte:head>

<PageHeader crumbs={[{ href: "/journal", label: "Journal" }, { label: c.name }]} title={c.name}>
  <div class="flex items-center gap-3 text-[15px] text-ink-muted">
    <span class="inline-block size-3 rounded-full border border-line" style="background: {CLASS_COLOR[c.class ?? ''] ?? 'var(--surface-2)'}"></span>
    <span>Level <span class="num text-ink">{c.level ?? "?"}</span> {c.race ?? ""} {titleCase(c.class)}{c.faction ? ` · ${c.faction}` : ""} · {realmName(c)}</span>
  </div>
</PageHeader>

<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
  <StatTile value={played(data.stats.played_total)} label="played" />
  <StatTile value={data.questsCompleted} label="quests completed" />
  <StatTile value={data.achievements.points} label="achievement points" />
  <StatTile value={data.exploredCount} label="areas explored" />
  <StatTile value={data.flightPaths.length} label="flight paths known" />
  <StatTile value={data.stats.deaths ?? 0} label="deaths" />
  <StatTile value={data.stats.sessions ?? data.sessions.length} label="sessions" />
</div>

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
  <div class="min-w-0 space-y-10">
  <section>
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="text-[17px] font-semibold">Achievements <span class="num text-[13px] font-normal text-ink-faint">{data.achievements.earned.length} of {data.achievements.total}</span></h2>
      <a href="/journal/achievements" class="text-[13px]">All achievements →</a>
    </div>
    {#if data.achievements.earned.length || data.achievements.nextUp.length}
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 class="eyebrow mb-1.5 px-1">Earned</h3>
          {#if data.achievements.earned.length}
            <ul class="card divide-y divide-line text-[14px]">
              {#each data.achievements.earned.slice(0, 8) as a (a.key)}
                <li class="flex items-center justify-between gap-3 px-4 py-2"><span><span class="font-medium">{a.name}</span>{#if a.points}<span class="num ml-1.5 text-[12px] text-gold">{a.points}</span>{/if}</span><span class="num text-[12px] text-ink-faint">{new Date(a.earnedAt ?? "").toLocaleDateString()}</span></li>
              {/each}
            </ul>
          {:else}
            <p class="px-1 text-[14px] text-ink-muted">None yet.</p>
          {/if}
        </div>
        <div>
          <h3 class="eyebrow mb-1.5 px-1">Closest</h3>
          <ul class="card divide-y divide-line text-[14px]">
            {#each data.achievements.nextUp as a (a.key)}
              <li class="px-4 py-2">
                <div class="flex items-center justify-between gap-3"><span class="font-medium">{a.name}</span><span class="num text-[12px] text-ink-faint">{Math.round(a.fraction * 100)}%</span></div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div class="h-full rounded-full bg-gold" style="width: {Math.round(a.fraction * 100)}%"></div></div>
                {#if a.criteria.length === 1}<div class="num mt-1 text-[12px] text-ink-faint">{a.criteria[0]!.current} / {a.criteria[0]!.required}</div>{/if}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {:else}
      <p class="text-[14px] text-ink-muted">Nothing measured yet. Level up, finish quests, explore.</p>
    {/if}
  </section>
  <section class="min-w-0">
    <h2 class="mb-3 text-[17px] font-semibold">Timeline</h2>
    {#if byDay.length}
      <div class="space-y-6">
        {#each byDay as [day, events]}
          <div>
            <div class="eyebrow mb-1.5">{day}</div>
            <ol class="card divide-y divide-line text-[14px]">
              {#each events ?? [] as e}
                <li class="flex items-baseline gap-3 px-4 py-2">
                  <span class="num w-12 shrink-0 text-ink-faint">{new Date(e.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                  <span class="w-4 shrink-0 text-center text-gold" aria-hidden="true">{glyph[e.kind] ?? "·"}</span>
                  <span>{describe(e)}</span>
                </li>
              {/each}
            </ol>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-[14px] text-ink-muted">Nothing yet. Play, log out, and sync.</p>
    {/if}
  </section>
  </div>
  <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
    <Card title="Zones visited">
      <ul class="space-y-1.5 text-[14px]">
        {#each data.zonesVisited as z (z.mapId)}
          <li class="flex justify-between gap-2"><a href="/wiki/{c.flavor}/zone/{z.mapId}">{data.maps[z.mapId] ?? `Map ${z.mapId}`}</a><span class="num text-ink-faint">{new Date(z.at).toLocaleDateString()}</span></li>
        {/each}
        {#if !data.zonesVisited.length}<li class="text-ink-muted">None yet.</li>{/if}
      </ul>
    </Card>
    {#if data.recentQuests.length}
      <Card title="Recent quests">
        <ul class="space-y-1.5 text-[14px]">
          {#each data.recentQuests as q (q.id)}
            <li class="flex justify-between gap-2"><a href="/wiki/{c.flavor}/quest/{q.id}">{q.title ?? `Quest #${q.id}`}</a>{#if q.at}<span class="num text-ink-faint">{new Date(q.at).toLocaleDateString()}</span>{/if}</li>
          {/each}
        </ul>
      </Card>
    {/if}
    {#if data.pets.length}
      <Card title="Pets">
        <ul class="space-y-1.5 text-[14px]">
          {#each data.pets as p (p.id ?? p.name)}
            <li><span class="font-medium">{p.name ?? "Pet"}</span>{#if p.active}<span class="ml-1.5 text-xs text-gold">with you</span>{/if}<span class="text-ink-muted"> · {p.family ?? "?"}{p.level ? ` · level ${p.level}` : ""}</span>{#if p.id}<a class="ml-1.5 text-[12px]" href="/wiki/{c.flavor}/creature/{p.id}">beast</a>{/if}{#if p.skills.length}<div class="text-[12px] text-ink-faint">{p.skills.map((s) => (s.r ? `${s.n} ${s.r}` : s.n)).join(", ")}</div>{/if}</li>
          {/each}
        </ul>
      </Card>
    {/if}
    <Card title="Flight paths known">
      <ul class="space-y-1.5 text-[14px]">
        {#each data.flightPaths as f (f.nodeId)}
          <li>{#if f.mapId !== null}<a href="/wiki/{c.flavor}/zone/{f.mapId}" class="text-ink hover:text-accent">{f.name}</a>{:else}{f.name}{/if}</li>
        {/each}
        {#if !data.flightPaths.length}<li class="text-ink-muted">None recorded yet. Open a flight master's map once.</li>{/if}
      </ul>
    </Card>
    <Card title="Sessions">
      <ul class="space-y-1.5 text-[14px]">
        {#each data.sessions.slice(0, 10) as s}
          <li class="flex justify-between gap-2"><span>{s.started_at ? new Date(s.started_at).toLocaleDateString() : "?"}</span><span class="num text-ink-muted">lvl {s.level_start ?? "?"}{s.level_end && s.level_end !== s.level_start ? `→${s.level_end}` : ""}</span></li>
        {/each}
      </ul>
    </Card>
    <Card title="Privacy">
      <p class="text-[13px] text-ink-muted">Only you can see this page.</p>
      <p class="mono mt-2 break-all text-[11px] text-ink-faint">{c.player_guid}</p>
    </Card>
  </aside>
</div>
