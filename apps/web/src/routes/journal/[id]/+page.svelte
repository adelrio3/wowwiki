<script lang="ts">
  import Card from "$lib/ui/Card.svelte";
  import StatTile from "$lib/ui/StatTile.svelte";
  let { data } = $props();
  const c = $derived(data.character);
  const realmName = $derived((Array.isArray(c.realms) ? c.realms[0]?.name : (c.realms as { name: string } | null)?.name) ?? "");
  const played = (s: number | undefined) => (s === undefined ? "?" : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
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
      case "first_sighting": return `First saw ${p.name ?? `${p.entity_type} #${p.entity_id}`}${p.entity_type !== "creature" ? ` (${p.entity_type})` : ""}`;
      default: return e.kind;
    }
  };
  const byDay = $derived(Object.entries(Object.groupBy(data.events, (e) => new Date(e.at).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))));
</script>

<svelte:head><title>{c.name} · Journal · WoW Compendium</title></svelte:head>

<article class="space-y-8">
  <header>
    <div class="text-sm text-ink-muted"><a href="/journal">Journal</a> · {realmName} · {c.flavor}</div>
    <h1 class="text-3xl font-medium">{c.name}</h1>
    <div class="text-ink-muted">Level <span class="num">{c.level ?? "?"}</span> {c.race ?? ""} {c.class ? c.class[0] + c.class.slice(1).toLowerCase() : ""}{c.faction ? ` · ${c.faction}` : ""}</div>
  </header>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile value={played(data.stats.played_total)} label="played" />
    <StatTile value={data.exploredCount} label="areas explored" />
    <StatTile value={data.stats.deaths ?? 0} label="deaths" />
    <StatTile value={data.stats.sessions ?? data.sessions.length} label="sessions" />
  </div>

  <div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
    <section class="min-w-0">
      <h2 class="mb-3 text-xl font-medium">Timeline</h2>
      {#if byDay.length}
        <div class="space-y-6">
          {#each byDay as [day, events]}
            <div>
              <div class="mb-1 text-xs uppercase tracking-wide text-ink-muted">{day}</div>
              <ol class="divide-y divide-line rounded-md border border-line bg-surface text-sm">
                {#each events ?? [] as e}
                  <li class="flex gap-3 px-3 py-1.5">
                    <span class="num w-14 shrink-0 text-ink-faint">{new Date(e.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                    <span class="w-4 shrink-0 text-center text-accent" aria-hidden="true">{glyph[e.kind] ?? "·"}</span>
                    <span>{describe(e)}</span>
                  </li>
                {/each}
              </ol>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-ink-muted">Nothing yet. Play, log out, and sync.</p>
      {/if}
    </section>
    <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <Card title="Sessions">
        <ul class="space-y-1 text-sm">
          {#each data.sessions.slice(0, 10) as s}
            <li class="flex justify-between gap-2"><span class="num text-ink-muted">#{s.seq}</span><span>{s.started_at ? new Date(s.started_at).toLocaleDateString() : "?"}</span><span class="num text-ink-faint">lvl {s.level_start ?? "?"}{s.level_end && s.level_end !== s.level_start ? `→${s.level_end}` : ""}</span></li>
          {/each}
        </ul>
      </Card>
      <Card title="Identity">
        <div class="num break-all text-xs text-ink-faint">{c.player_guid}</div>
        <p class="mt-2 text-xs text-ink-faint">This page is visible only to you.</p>
      </Card>
    </aside>
  </div>
</article>
