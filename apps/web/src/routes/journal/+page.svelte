<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  let { data } = $props();
  const realmName = (c: (typeof data.characters)[number]) => (Array.isArray(c.realms) ? c.realms[0]?.name : (c.realms as { name: string } | null)?.name) ?? "";
  const classTint: Record<string, string> = { HUNTER: "#67a63a", WARRIOR: "#a8794a", MAGE: "#2a9fc2", PRIEST: "#8a8f98", ROGUE: "#c9b43a", DRUID: "#d9700e", SHAMAN: "#1c6fc9", WARLOCK: "#7b6fd1", PALADIN: "#d66c9f" };
</script>

<svelte:head><title>Journal · WoW Compendium</title></svelte:head>

<div class="space-y-6">
  <header>
    <h1 class="text-3xl font-medium">Journal</h1>
    <p class="text-ink-muted">Your characters and their journeys. Private unless you say otherwise.</p>
  </header>
  {#if data.characters.length}
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.characters as c}
        <li class="overflow-hidden rounded-md border border-line bg-surface">
          <div class="h-1" style="background: {classTint[c.class ?? ''] ?? 'var(--accent)'}"></div>
          <a href="/journal/{c.id}" class="block px-4 py-3 text-ink hover:text-ink hover:no-underline">
            <div class="text-lg font-medium">{c.name}</div>
            <div class="text-sm text-ink-muted">Level <span class="num">{c.level ?? "?"}</span> {c.race ?? ""} {c.class ? c.class[0] + c.class.slice(1).toLowerCase() : ""}</div>
            <div class="mt-1 text-xs text-ink-faint">{realmName(c)} · {c.flavor} · last seen {new Date(c.last_seen_at).toLocaleDateString()}</div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <Empty text="No characters yet. Install the add-on, play, log out, and sync." href="/sync" action="Go to Sync" />
  {/if}
</div>
