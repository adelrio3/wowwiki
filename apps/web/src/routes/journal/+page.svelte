<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { CLASS_COLOR, realmName } from "$lib/journal-format";
  import { titleCase } from "$lib/wiki-format";
  let { data } = $props();
</script>

<svelte:head><title>Journal · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Your record" title="Journal" lede="Your characters and what they have been through. Private unless you choose otherwise." />

{#if data.characters.length}
  <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.characters as c (c.id)}
      <li>
        <a href="/journal/{c.id}" class="card flex items-center gap-3.5 px-4 py-3.5 text-ink hover:border-line-strong hover:no-underline">
          <span class="serif grid size-11 shrink-0 place-items-center rounded-full border border-line text-[20px] text-ink" style="background: color-mix(in srgb, {CLASS_COLOR[c.class ?? ''] ?? 'var(--surface-2)'} 45%, var(--surface))">{c.name[0]}</span>
          <span class="min-w-0">
            <span class="block truncate text-[17px] font-semibold">{c.name}</span>
            <span class="block text-[13px] text-ink-muted">Level <span class="num">{c.level ?? "?"}</span> {c.race ?? ""} {titleCase(c.class)}</span>
            <span class="block text-[12px] text-ink-faint">{realmName(c)} · last seen {new Date(c.last_seen_at).toLocaleDateString()}</span>
          </span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <Empty text="No characters yet. Install the add-on, play, log out, and sync." href="/sync" action="Set up the add-on" />
{/if}
