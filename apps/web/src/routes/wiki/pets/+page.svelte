<script lang="ts">
  import Empty from "$lib/ui/Empty.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { coord, levelRange } from "$lib/wiki-format";
  let { data } = $props();
  const sections = $derived([
    { id: "families", label: "Families", n: data.families.length },
    { id: "skills", label: "Pet skills", n: data.skills.length },
    { id: "forms", label: "Forms", n: data.forms.length },
    { id: "beasts", label: "Tamable beasts", n: data.rows.length },
  ]);
  const uniqueForms = $derived(data.forms.filter((f) => f.unique));
</script>

<svelte:head><title>Hunter pets · Classic Era · WoW Compendium</title></svelte:head>

<PageHeader eyebrow="Classic Era" title="Hunter pets" lede="Every beast the client calls tamable, by family: what it can learn, what it eats, what it looks like, and where it roams. Beast Lore and tamed pets confirm what the family implies.">
  <nav class="flex flex-wrap gap-1.5 pt-2" aria-label="On this page">
    {#each sections as s}
      <a href="#{s.id}" class="rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink hover:no-underline">{s.label} <span class="num text-ink-faint">{s.n}</span></a>
    {/each}
  </nav>
</PageHeader>

{#if !data.total}
  <Empty text="No tamable beast recorded yet. Target a wolf, a cat, a boar." href="/sync" action="Get the add-on" />
{:else}
  <div class="space-y-12">
    <section id="families" class="scroll-mt-20">
      <h2 class="mb-3 text-[17px] font-semibold">Families <span class="num text-[13px] font-normal text-ink-faint">{data.families.length}</span></h2>
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.families as f (f.name)}
          <li>
            <a href="/wiki/pets?family={encodeURIComponent(f.name)}#beasts" class="card block px-4 py-3 text-ink hover:border-line-strong hover:no-underline {data.family === f.name ? 'border-gold' : ''}">
              <div class="flex items-baseline justify-between gap-3">
                <span class="serif text-[20px]">{f.name}</span>
                <span class="num text-[13px] text-ink-faint">{f.beasts} beast{f.beasts === 1 ? "" : "s"}</span>
              </div>
              <div class="mt-1 text-[13px] text-ink-muted">
                {#if f.levelMin !== null}Levels <span class="num">{levelRange(f.levelMin, f.levelMax)}</span>{/if}
                {#if f.diets.length}<span class="mx-1.5 text-ink-faint">·</span>Eats {f.diets.join("; ")}{/if}
                {#if f.looks}<span class="mx-1.5 text-ink-faint">·</span><span class="num">{f.looks}</span> look{f.looks === 1 ? "" : "s"}{/if}
              </div>
              {#if f.skills.length}<div class="mt-1.5 text-[13px] text-ink-muted">Skills: {f.skills.join(", ")}</div>{/if}
              {#if f.confirmed}<div class="mt-1 text-[12px] text-ok">{f.confirmed} confirmed tamable</div>{/if}
            </a>
          </li>
        {/each}
      </ul>
    </section>

    <section id="skills" class="scroll-mt-20">
      <h2 class="mb-1 text-[17px] font-semibold">Pet skills <span class="num text-[13px] font-normal text-ink-faint">{data.skills.length}</span></h2>
      <p class="mb-3 text-[13px] text-ink-faint">Learned by taming a beast that knows the rank. Read from the tooltip a hunter's Beast Lore shows; a skill is listed once a hunter has cast it on the beast.</p>
      {#if data.skills.length}
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Skill</th><th class="r">Rank</th><th>Tame one of these</th></tr></thead>
            <tbody>
              {#each data.skills as s}
                <tr>
                  <td class="font-medium">{s.name}</td>
                  <td class="num r">{s.rank ?? ""}</td>
                  <td class="text-ink-muted">
                    {#each s.beasts as b, i}{#if i > 0}<span class="mx-1.5 text-ink-faint">·</span>{/if}<a class="text-ink hover:text-accent" href="/wiki/{data.flavor}/creature/{b.id}">{b.name}</a> <span class="num text-ink-faint">{levelRange(b.level_min, b.level_max)}</span>{#if b.place}<span class="text-ink-faint"> in </span><a href="/wiki/{data.flavor}/zone/{b.place.map_id}" class="text-ink-muted hover:text-ink">{b.place.name}</a>{/if}{/each}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-[14px] text-ink-muted">No skill ranks recorded yet. Cast Beast Lore on a beast while the add-on runs.</p>
      {/if}
    </section>

    <section id="forms" class="scroll-mt-20">
      <h2 class="mb-1 text-[17px] font-semibold">Forms <span class="num text-[13px] font-normal text-ink-faint">{data.forms.length}</span></h2>
      <p class="mb-3 text-[13px] text-ink-faint">A form is a look the client draws; beasts that share one are the same pet once tamed. <span class="num text-ink-muted">{uniqueForms.length}</span> of these belong to a single beast.{#if data.unknownLook} <span class="num text-ink-muted">{data.unknownLook}</span> beasts have no look recorded yet.{/if}</p>
      {#if data.forms.length}
        <div class="card overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Form</th><th>Family</th><th>Beasts with this look</th><th class="r">Only one</th></tr></thead>
            <tbody>
              {#each data.forms as f (f.displayId)}
                <tr>
                  <td class="num text-ink-muted">#{f.displayId}</td>
                  <td>{f.family}</td>
                  <td class="text-ink-muted">
                    {#each f.beasts as b, i}{#if i > 0}<span class="mx-1.5 text-ink-faint">·</span>{/if}<a class="text-ink hover:text-accent" href="/wiki/{data.flavor}/creature/{b.id}">{b.name}</a> <span class="num text-ink-faint">{levelRange(b.level_min, b.level_max)}</span>{#if b.place}<span class="text-ink-faint"> in </span><a href="/wiki/{data.flavor}/zone/{b.place.map_id}" class="text-ink-muted hover:text-ink">{b.place.name}</a>{/if}{/each}
                  </td>
                  <td class="r">{#if f.unique}<span class="text-gold">Unique</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-[14px] text-ink-muted">No looks recorded yet.</p>
      {/if}
    </section>

    <section id="beasts" class="scroll-mt-20">
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-[17px] font-semibold">Tamable beasts <span class="num text-[13px] font-normal text-ink-faint">{data.rows.length}</span></h2>
        {#if data.family}<a href="/wiki/pets#beasts" class="text-[13px]">All families</a>{/if}
      </div>
      <div class="card overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>Beast</th><th>Family</th><th class="r">Level</th><th>Where</th><th>Skills</th><th>Eats</th><th>Form</th></tr></thead>
          <tbody>
            {#each data.rows as b (b.entity_id)}
              <tr>
                <td><a class="name" href="/wiki/{data.flavor}/creature/{b.entity_id}">{b.name}</a>{#if b.tameable || b.tamed}<span class="ml-2 text-xs text-ok" title={b.tamed ? "Seen as a hunter's pet" : "Beast Lore said Tameable"}>✓</span>{/if}</td>
                <td class="text-ink-muted">{b.family}</td>
                <td class="num r">{levelRange(b.level_min, b.level_max)}</td>
                <td class="text-ink-muted">{#if b.place}<a href="/wiki/{data.flavor}/zone/{b.place.map_id}" class="text-ink-muted hover:text-ink">{b.place.name}</a><span class="num ml-2 text-ink-faint">{coord(b.place.x, b.place.y)}</span>{/if}</td>
                <td class="text-ink-muted">{b.skills.map((s) => (s.rank ? `${s.name} ${s.rank}` : s.name)).join(", ")}</td>
                <td class="text-ink-muted">{b.diet ?? ""}</td>
                <td class="num text-ink-muted">{#if b.displayId !== null}#{b.displayId}{#if b.shared === 1}<span class="ml-1.5 text-xs text-gold">unique</span>{/if}{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
{/if}
