<script lang="ts">
  import Empty from "./Empty.svelte";
  import ItemIcon from "./ItemIcon.svelte";
  import { equipLabel, qualityClass } from "$lib/wiki-format";
  interface Row { entity_id: number; name: string; quality: number | null; item_level: number | null; required_level: number | null; class: string | null; subclass: string | null; equip_loc: string | null; iconUrl: string | null; drops: number; sells: number; fished: boolean }
  let { rows, flavor, emptyText = "Nothing here yet." }: { rows: Row[]; flavor: string; emptyText?: string } = $props();
  const source = (r: Row) => {
    const parts: string[] = [];
    if (r.drops) parts.push(`${r.drops} drop source${r.drops === 1 ? "" : "s"}`);
    if (r.sells) parts.push(`${r.sells} vendor${r.sells === 1 ? "" : "s"}`);
    if (r.fished) parts.push("fishing");
    return parts.join(" · ");
  };
</script>

{#if rows.length}
  <div class="card overflow-x-auto">
    <table class="tbl">
      <thead><tr><th>Item</th><th>Type</th><th>Slot</th><th class="r">Item level</th><th class="r">Requires</th><th>Where from</th></tr></thead>
      <tbody>
        {#each rows as r (r.entity_id)}
          <tr>
            <td>
              <a class="name flex items-center gap-2.5" href="/wiki/{flavor}/item/{r.entity_id}">
                <ItemIcon url={r.iconUrl} name={r.name} size={30} />
                <span class={qualityClass(r.quality)}>{r.name}</span>
              </a>
            </td>
            <td class="text-ink-muted">{r.class ?? ""}{#if r.subclass && r.subclass !== r.class}<span class="mx-1.5 text-ink-faint">·</span>{r.subclass}{/if}</td>
            <td class="text-ink-muted">{equipLabel(r.equip_loc)}</td>
            <td class="num r">{r.item_level ?? ""}</td>
            <td class="num r">{r.required_level ? r.required_level : ""}</td>
            <td class="text-ink-muted">{source(r) || "not seen dropping or for sale yet"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <Empty text={emptyText} />
{/if}
