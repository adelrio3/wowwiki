<script lang="ts">
  import Button from "$lib/ui/Button.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { CLASSIFICATION_LABEL, levelRange } from "$lib/wiki-format";
  let { data } = $props();
  const n = (v: number) => v.toLocaleString();
</script>

<svelte:head><title>WoW Compendium · what players have seen in Azeroth</title></svelte:head>

<div class="space-y-14">
  <section class="max-w-3xl space-y-5 pt-2">
    <div class="eyebrow">World of Warcraft · Classic Era</div>
    <h1 class="serif text-[40px] leading-[1.05] text-ink sm:text-[52px]">Azeroth, as players<br class="hidden sm:block" /> actually found it.</h1>
    <p class="max-w-xl text-[16px] text-ink-muted">A wiki written by game clients. Every NPC, creature and place here was seen by someone playing, recorded by our add-on, and sent in. Nothing is copied from anywhere else.</p>
    <form action="/wiki" class="flex max-w-xl gap-2">
      <label class="sr-only" for="home-search">Search</label>
      <div class="relative flex-1">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"><Icon name="search" size={18} /></span>
        <input id="home-search" name="q" type="search" placeholder="Search an NPC, creature, item, quest, zone or area" class="field py-2.5 pl-10 text-[15px]" />
      </div>
      <Button type="submit">Search</Button>
    </form>
    <p class="text-[13px] text-ink-faint"><span class="num text-ink-muted">{n(data.counts.creatures)}</span> NPCs and creatures · <span class="num text-ink-muted">{n(data.counts.items)}</span> items · <span class="num text-ink-muted">{n(data.counts.quests)}</span> quests · <span class="num text-ink-muted">{n(data.counts.zones)}</span> zones · <span class="num text-ink-muted">{n(data.counts.areas)}</span> areas · <span class="num text-ink-muted">{n(data.counts.contributors)}</span> contributor{data.counts.contributors === 1 ? "" : "s"}</p>
  </section>

  <section>
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="text-[17px] font-semibold">Zones</h2>
      <a href="/wiki" class="text-[13px]">All zones →</a>
    </div>
    {#if data.zones.length}
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.zones as z (z.entity_id)}
          <li>
            <a href="/wiki/era/zone/{z.entity_id}" class="card group block px-4 py-3.5 text-ink hover:border-line-strong hover:no-underline">
              <div class="flex items-center justify-between gap-3"><span class="serif text-[20px]">{z.name}</span><Icon name="arrow" size={16} class="text-ink-faint transition-transform group-hover:translate-x-0.5" /></div>
              <div class="mt-1.5 text-[13px] text-ink-muted">{#if z.parentName}{z.parentName}<span class="mx-1.5 text-ink-faint">·</span>{/if}<span class="num">{z.units}</span> NPC{z.units === 1 ? "" : "s"} &amp; creatures</div>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-[14px] text-ink-muted">The record is empty. Someone has to go first.</p>
    {/if}
  </section>

  {#if data.notable.length}
    <section>
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-[17px] font-semibold">Notable finds</h2>
        <span class="text-[13px] text-ink-faint">Rares, elites and bosses players have run into</span>
      </div>
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.notable as u (u.entity_id)}
          <li>
            <a href="/wiki/era/creature/{u.entity_id}" class="card block px-4 py-3 text-ink hover:border-line-strong hover:no-underline">
              <div class="flex items-center justify-between gap-2"><span class="font-semibold">{u.name}</span><span class="text-[12px] font-medium text-gold">{CLASSIFICATION_LABEL[u.classification ?? ""] ?? u.classification}</span></div>
              <div class="mt-0.5 text-[13px] text-ink-muted">Level <span class="num">{levelRange(u.level_min, u.level_max) || "?"}</span>{#if u.creature_type}<span class="mx-1.5 text-ink-faint">·</span>{u.creature_type}{/if}{#if u.place}<span class="mx-1.5 text-ink-faint">·</span>{u.place.name}{/if}</div>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div>
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-[17px] font-semibold">Recently seen</h2>
        <a href="/wiki/npcs" class="text-[13px]">NPCs →</a>
      </div>
      {#if data.units.length}
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Name</th><th></th><th class="r">Level</th><th>Zone</th></tr></thead>
            <tbody>
              {#each data.units as u (u.entity_id)}
                <tr>
                  <td><a class="name" href="/wiki/era/creature/{u.entity_id}">{u.name}</a></td>
                  <td class="text-[12px] uppercase tracking-wide text-ink-faint">{u.kind}</td>
                  <td class="num r">{levelRange(u.level_min, u.level_max)}</td>
                  <td>{#if u.place}<a href="/wiki/era/zone/{u.place.map_id}" class="text-ink-muted hover:text-ink">{u.place.name}</a>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-[14px] text-ink-muted">Nothing yet.</p>
      {/if}
    </div>

    <aside class="card self-start p-5">
      <div class="mb-2 grid size-9 place-items-center rounded-lg bg-gold-soft text-gold"><Icon name="plug" size={18} /></div>
      <h2 class="text-[17px] font-semibold">Add what you see</h2>
      <ol class="mt-2 space-y-2 text-[14px] text-ink-muted">
        <li><span class="num mr-1.5 text-ink-faint">1</span>Install the add-on from this site. It has no interface and changes nothing in your game.</li>
        <li><span class="num mr-1.5 text-ink-faint">2</span>Play as you always do, then log out.</li>
        <li><span class="num mr-1.5 text-ink-faint">3</span>Sync. The wiki grows and your private Journal fills in.</li>
      </ol>
      <Button href="/sync" class="mt-4 w-full">Get the add-on</Button>
    </aside>
  </section>
</div>
