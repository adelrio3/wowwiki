<script lang="ts">
  let { data } = $props();
  const realmName = (c: (typeof data.characters)[number]) => (Array.isArray(c.realms) ? c.realms[0]?.name : (c.realms as { name: string } | null)?.name) ?? "";
</script>

<section class="space-y-4 max-w-3xl">
  <h1 class="text-2xl font-bold">Journal</h1>
  <p class="text-stone-300">Your characters and their journeys. Private unless you say otherwise.</p>
  <ul class="divide-y divide-stone-800 rounded border border-stone-800">
    {#each data.characters as c}
      <li class="flex items-center gap-4 p-3">
        <div class="flex-1">
          <a href="/journal/{c.id}" class="font-medium">{c.name}</a>
          <span class="text-stone-400 text-sm"> · {realmName(c)} · {c.flavor}</span>
          <div class="text-sm text-stone-400">Level {c.level ?? "?"} {c.race ?? ""} {c.class ?? ""}{c.faction ? ` · ${c.faction}` : ""}</div>
        </div>
        <div class="text-xs text-stone-500">last seen {new Date(c.last_seen_at).toLocaleDateString()}</div>
      </li>
    {/each}
    {#if !data.characters.length}<li class="p-4 text-stone-500">No characters yet. Install the add-on from the <a href="/sync">Sync</a> page, play, log out, and sync.</li>{/if}
  </ul>
</section>
