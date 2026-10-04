<script lang="ts">
  let { data } = $props();
  const c = $derived(data.character);
  const realmName = $derived((Array.isArray(c.realms) ? c.realms[0]?.name : (c.realms as { name: string } | null)?.name) ?? "");
  const played = (s: number | undefined) => (s === undefined ? "?" : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
  type Ev = (typeof data.events)[number];
  const describe = (e: Ev): string => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    switch (e.kind) {
      case "login": return `Logged in (level ${p.level})`;
      case "logout": return `Logged out (level ${p.level})`;
      case "level_up": return `Reached level ${p.level}`;
      case "zone_enter": return `Entered ${data.maps[e.map_id ?? -1] ?? p.zone ?? "a new map"}`;
      case "area_discovered": return `Discovered ${p.name}${p.xp ? ` (+${p.xp} xp)` : ""}`;
      case "instance_enter": return `Entered an instance`;
      case "death": return `Died at level ${p.level}`;
      case "first_sighting": return `First saw ${p.name ?? `${p.entity_type} #${p.entity_id}`}${p.entity_type === "creature" ? "" : ` (${p.entity_type})`}`;
      default: return e.kind;
    }
  };
</script>

<svelte:head><title>{c.name} · Journal</title></svelte:head>

<article class="space-y-6 max-w-3xl">
  <header>
    <div class="text-sm text-stone-400"><a href="/journal">Journal</a> · {realmName} · {c.flavor}</div>
    <h1 class="text-3xl font-bold">{c.name}</h1>
    <div class="text-stone-300">Level {c.level ?? "?"} {c.race ?? ""} {c.class ?? ""}{c.faction ? ` · ${c.faction}` : ""}</div>
  </header>

  <div class="grid gap-3 sm:grid-cols-4 text-sm">
    <div class="rounded border border-stone-800 p-3"><div class="text-xl font-semibold">{played(data.stats.played_total)}</div><div class="text-stone-400">played</div></div>
    <div class="rounded border border-stone-800 p-3"><div class="text-xl font-semibold">{data.exploredCount}</div><div class="text-stone-400">areas explored</div></div>
    <div class="rounded border border-stone-800 p-3"><div class="text-xl font-semibold">{data.stats.deaths ?? 0}</div><div class="text-stone-400">deaths</div></div>
    <div class="rounded border border-stone-800 p-3"><div class="text-xl font-semibold">{data.stats.sessions ?? data.sessions.length}</div><div class="text-stone-400">sessions</div></div>
  </div>

  <section>
    <h2 class="font-semibold mb-2">Timeline</h2>
    <ol class="space-y-1 text-sm">
      {#each data.events as e}
        <li class="flex gap-3"><span class="text-stone-500 w-40 shrink-0">{new Date(e.at).toLocaleString()}</span><span>{describe(e)}</span></li>
      {/each}
      {#if !data.events.length}<li class="text-stone-500">Nothing yet.</li>{/if}
    </ol>
  </section>
</article>
