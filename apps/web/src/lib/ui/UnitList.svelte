<script lang="ts">
  import Empty from "./Empty.svelte";
  import { CLASSIFICATION_LABEL, coord, levelRange } from "$lib/wiki-format";
  interface Place { map_id: number; name: string; x: number | null; y: number | null; sightings: number }
  interface Row { entity_id: number; name: string; level_min: number | null; level_max: number | null; creature_type: string | null; classification: string | null; places: Place[] }
  let { rows, flavor, emptyText = "Nothing here yet.", showZone = true, mapId }: { rows: Row[]; flavor: string; emptyText?: string; showZone?: boolean; mapId?: number } = $props();
  const where = (r: Row) => (mapId !== undefined ? r.places.filter((p) => p.map_id === mapId) : r.places).slice(0, showZone ? 2 : 3);
</script>

{#if rows.length}
  <div class="card overflow-x-auto">
    <table class="tbl">
      <thead><tr><th>Name</th><th class="r">Level</th><th>Type</th><th>{showZone ? "Where" : "Coordinates"}</th></tr></thead>
      <tbody>
        {#each rows as r (r.entity_id)}
          <tr>
            <td><a class="name" href="/wiki/{flavor}/creature/{r.entity_id}">{r.name}</a>{#if r.classification && r.classification !== "normal"}<span class="ml-2 text-xs text-gold">{CLASSIFICATION_LABEL[r.classification] ?? r.classification}</span>{/if}</td>
            <td class="num r whitespace-nowrap">{levelRange(r.level_min, r.level_max)}</td>
            <td class="text-ink-muted">{r.creature_type ?? ""}</td>
            <td class="text-ink-muted">
              {#each where(r) as p, i}{#if i > 0}<span class="mx-1.5 text-ink-faint">·</span>{/if}{#if showZone}<a href="/wiki/{flavor}/zone/{p.map_id}" class="text-ink-muted hover:text-ink">{p.name}</a>{/if}<span class="num text-ink-faint {showZone ? 'ml-2' : ''}">{coord(p.x, p.y)}</span>{/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <Empty text={emptyText} />
{/if}
