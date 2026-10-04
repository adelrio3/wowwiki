<script lang="ts">
  import Badge from "$lib/ui/Badge.svelte";
  import { CLASSIFICATION_LABEL } from "$lib/wiki-format";
  interface Row {
    entity_id: number;
    name: string;
    status: string;
    level_min: number | null;
    level_max: number | null;
    creature_type: string | null;
    classification: string | null;
    positions?: unknown[];
  }
  let { rows, flavor, title, emptyText, showSpots = false }: { rows: Row[]; flavor: string; title: string; emptyText: string; showSpots?: boolean } = $props();
</script>

<section>
  <h2 class="mb-2 text-xl">{title} <span class="num text-sm text-ink-faint">{rows.length}</span></h2>
  {#if rows.length}
    <div class="overflow-x-auto rounded-md border border-line bg-surface">
      <table class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th class="px-3 py-2 font-medium">Name</th>
            <th class="px-3 py-2 font-medium">Level</th>
            <th class="px-3 py-2 font-medium">Type</th>
            {#if showSpots}<th class="px-3 py-2 font-medium">Spots</th>{/if}
            <th class="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as c}
            <tr class="border-t border-line even:bg-surface-2/40">
              <td class="px-3 py-1.5"><a href="/wiki/{flavor}/creature/{c.entity_id}">{c.name}</a>{#if c.classification && c.classification !== "normal"}<span class="ml-2 text-xs text-ink-muted">{CLASSIFICATION_LABEL[c.classification] ?? c.classification}</span>{/if}</td>
              <td class="num px-3 py-1.5">{c.level_min === null ? "" : c.level_min === c.level_max ? c.level_min : `${c.level_min}–${c.level_max}`}</td>
              <td class="px-3 py-1.5 text-ink-muted">{c.creature_type ?? ""}</td>
              {#if showSpots}<td class="num px-3 py-1.5">{c.positions?.length ?? 0}</td>{/if}
              <td class="px-3 py-1.5"><Badge status={c.status} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="text-sm text-ink-muted">{emptyText}</p>
  {/if}
</section>
