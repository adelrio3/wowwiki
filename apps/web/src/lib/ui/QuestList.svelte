<script lang="ts">
  import Empty from "./Empty.svelte";
  interface Row { entity_id: number; name: string; level: number | null; zone: string | null; mapId: number | null; giver: { id: number; name: string } | null; ender: { id: number; name: string } | null; item_started: boolean }
  let { rows, flavor, emptyText = "Nothing here yet.", showZone = true }: { rows: Row[]; flavor: string; emptyText?: string; showZone?: boolean } = $props();
</script>

{#if rows.length}
  <div class="card overflow-x-auto">
    <table class="tbl">
      <thead><tr><th>Quest</th><th class="r">Level</th>{#if showZone}<th>Starts in</th>{/if}<th>Given by</th><th>Turned in to</th></tr></thead>
      <tbody>
        {#each rows as r (r.entity_id)}
          <tr>
            <td><a class="name" href="/wiki/{flavor}/quest/{r.entity_id}">{r.name}</a></td>
            <td class="num r">{r.level ?? ""}</td>
            {#if showZone}<td class="text-ink-muted">{#if r.mapId !== null}<a href="/wiki/{flavor}/zone/{r.mapId}" class="text-ink-muted hover:text-ink">{r.zone ?? `Map ${r.mapId}`}</a>{/if}</td>{/if}
            <td class="text-ink-muted">{#if r.giver}<a href="/wiki/{flavor}/creature/{r.giver.id}" class="text-ink-muted hover:text-ink">{r.giver.name}</a>{:else if r.item_started}An item{/if}</td>
            <td class="text-ink-muted">{#if r.ender}<a href="/wiki/{flavor}/creature/{r.ender.id}" class="text-ink-muted hover:text-ink">{r.ender.name}</a>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <Empty text={emptyText} />
{/if}
