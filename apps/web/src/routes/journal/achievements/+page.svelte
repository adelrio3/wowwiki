<script lang="ts">
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import StatTile from "$lib/ui/StatTile.svelte";
  let { data } = $props();
</script>

<svelte:head><title>Achievements · Journal · WoW Compendium</title></svelte:head>

<PageHeader crumbs={[{ href: "/journal", label: "Journal" }, { label: "Achievements" }]} title="Achievements" lede="Classic Era has no achievements of its own, so these are the Compendium's: the ones Wrath of the Lich King gave this content, rebuilt from what your characters' clients recorded, plus a few of our own. Account-wide: earned by any character counts." />

<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
  <StatTile value={data.points} label="points" />
  <StatTile value={data.earned} label="earned" />
  <StatTile value={data.total} label="in the list" />
</div>

<div class="space-y-10">
  {#each data.categories as cat (cat.key)}
    <section>
      <h2 class="mb-3 text-[17px] font-semibold">{cat.name}</h2>
      <div class="space-y-4">
        {#each cat.groups as g (g.key)}
          <div>
            {#if g.name}<h3 class="eyebrow mb-1.5 px-1">{g.name}</h3>{/if}
            <ul class="card divide-y divide-line">
              {#each g.rows as a (a.key)}
                {#if !a.feat || a.earnedAt}
                  <li class="px-4 py-2.5 {a.earnedAt ? '' : 'text-ink-muted'}">
                    <details class="group">
                      <summary class="flex list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                        <span class="grid size-8 shrink-0 place-items-center rounded-md border text-[13px] {a.earnedAt ? 'border-gold bg-gold-soft text-gold' : 'border-line bg-surface-2 text-ink-faint'}">{a.feat ? "★" : a.points}</span>
                        <span class="min-w-0 flex-1">
                          <span class="block text-[14px] font-medium {a.earnedAt ? 'text-ink' : ''}">{a.name}{#if a.original}<span class="ml-1.5 text-[11px] font-normal uppercase tracking-wide text-ink-faint">Compendium</span>{/if}</span>
                          <span class="block text-[13px] text-ink-muted">{a.description}</span>
                        </span>
                        <span class="num shrink-0 text-right text-[12px] text-ink-faint">
                          {#if a.earnedAt}<span class="block text-ok">Earned {new Date(a.earnedAt).toLocaleDateString()}</span>{#if a.earnedBy}<span class="block">by {a.earnedBy}</span>{/if}{:else if a.fraction > 0}<span class="block">{Math.round(a.fraction * 100)}%</span>{#if a.bestBy}<span class="block">{a.bestBy}</span>{/if}{/if}
                        </span>
                      </summary>
                      {#if a.criteria.length}
                        <ul class="mt-2 grid gap-x-6 gap-y-0.5 pl-11 text-[13px] sm:grid-cols-2">
                          {#each a.criteria as c}
                            <li class="flex items-center justify-between gap-2 {c.met ? 'text-ink' : 'text-ink-faint'}"><span>{c.met ? "✓" : "·"} {c.label}</span>{#if c.required > 1}<span class="num">{c.current} / {c.required}</span>{/if}</li>
                          {/each}
                        </ul>
                      {/if}
                    </details>
                  </li>
                {/if}
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>
<p class="mt-8 text-[12px] text-ink-faint">Catalog version <span class="num">{data.version}</span>. Criteria never change once released; new achievements are added at the end.</p>
