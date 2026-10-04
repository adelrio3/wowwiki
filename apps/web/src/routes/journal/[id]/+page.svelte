<script lang="ts">
  import Card from "$lib/ui/Card.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import StatTile from "$lib/ui/StatTile.svelte";
  import { CLASS_COLOR, played, realmName } from "$lib/journal-format";
  import { titleCase } from "$lib/wiki-format";
  let { data } = $props();
  const c = $derived(data.character);
  type Ev = (typeof data.events)[number];
  const glyph: Record<string, string> = { login: "○", logout: "●", level_up: "▲", zone_enter: "→", area_discovered: "✦", instance_enter: "⌂", death: "✕", first_sighting: "◇" };
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

<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
  <StatTile value={played(data.stats.played_total)} label="played" />
  <StatTile value={data.exploredCount} label="areas explored" />
  <StatTile value={data.stats.deaths ?? 0} label="deaths" />
  <StatTile value={data.stats.sessions ?? data.sessions.length} label="sessions" />
</div>

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
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
  <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
