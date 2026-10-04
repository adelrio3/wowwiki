<script lang="ts">
  import Badge from "$lib/ui/Badge.svelte";
  import Button from "$lib/ui/Button.svelte";
  import StatTile from "$lib/ui/StatTile.svelte";
  let { data } = $props();
</script>

<svelte:head><title>WoW Compendium</title></svelte:head>

<div class="space-y-12">
  <section class="max-w-3xl space-y-5">
    <h1 class="text-4xl font-medium leading-tight sm:text-5xl">A record of Azeroth, written by the people who walk it.</h1>
    <p class="text-lg text-ink-muted">
      Every entry here was observed in a real player's game client by our add-on. Nothing is imported from anywhere else.
      Install it, play, and what you see becomes part of the record. Your own journey stays private in your Journal until you choose to share it.
    </p>
    <div class="flex flex-wrap gap-3">
      <Button href="/sync">Get the add-on</Button>
      <Button href="/wiki" variant="secondary">Browse the wiki</Button>
    </div>
  </section>

  <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile value={data.counts.creatures} label="NPCs and creatures observed" />
    <StatTile value={data.counts.zones} label="zones visited" />
    <StatTile value={data.counts.areas} label="areas mapped" />
    <StatTile value={data.counts.contributors} label="contributors" />
  </section>

  <section class="grid gap-8 md:grid-cols-2">
    <div>
      <h2 class="mb-3 text-xl font-medium">Recently observed</h2>
      <ul class="divide-y divide-line rounded-md border border-line bg-surface">
        {#each data.units as c}
          <li class="flex items-center justify-between gap-2 px-4 py-2 text-sm"><span class="min-w-0 truncate"><a href="/wiki/era/creature/{c.entity_id}">{c.name}</a><span class="ml-2 text-xs text-ink-muted">{c.kind}</span></span><Badge status={c.status} /></li>
        {/each}
        {#if !data.units.length}<li class="px-4 py-3 text-sm text-ink-muted">The record is empty. Someone has to go first.</li>{/if}
      </ul>
    </div>
    <div>
      <h2 class="mb-3 text-xl font-medium">Zones in the record</h2>
      <ul class="divide-y divide-line rounded-md border border-line bg-surface">
        {#each data.zones as z}
          <li class="flex items-center justify-between px-4 py-2 text-sm"><a href="/wiki/era/zone/{z.entity_id}">{z.name}</a><span class="num text-xs text-ink-faint">build {z.last_build}</span></li>
        {/each}
        {#if !data.zones.length}<li class="px-4 py-3 text-sm text-ink-muted">No zones yet.</li>{/if}
      </ul>
    </div>
  </section>

  <section class="grid gap-4 sm:grid-cols-3">
    {#each [["Install", "Connect your World of Warcraft folder once. The site installs and updates the add-on itself."], ["Play", "The add-on records silently: creatures, places, quests, and your own milestones. No in-game interface."], ["Sync", "Log out, open this site, click Sync. The world grows and your Journal fills in."]] as [title, body], i}
      <div class="rounded-md border border-line bg-surface p-4">
        <div class="num text-xs text-ink-faint">0{i + 1}</div>
        <h3 class="mt-1 text-lg font-medium">{title}</h3>
        <p class="mt-1 text-sm text-ink-muted">{body}</p>
      </div>
    {/each}
  </section>
</div>
