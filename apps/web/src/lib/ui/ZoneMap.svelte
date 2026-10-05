<script lang="ts">
  /**
   * A map with one clickable, map-shaped region per child map (D-0047). No
   * text is drawn on the map: the list beside it names the regions, and
   * hovering either one highlights the other through `hover`.
   */
  export interface Region { id: number; name: string; href: string; shape: string }
  let { art, title, regions, hover = $bindable(null), class: cls = "" }: { art: { url: string; width: number; height: number }; title: string; regions: Region[]; hover?: number | null; class?: string } = $props();
  const H = $derived((100 * art.height) / art.width);
</script>

<figure class="relative overflow-hidden rounded-xl border border-line bg-surface-2 shadow-card {cls}">
  <img src={art.url} width={art.width} height={art.height} alt={title} class="block h-full w-full object-cover" decoding="async" />
  <svg viewBox="0 0 100 {H}" class="absolute inset-0 h-full w-full" aria-label="Regions on this map">
    {#each regions as r (r.id)}
      <a href={r.href} aria-label={r.name} onmouseenter={() => (hover = r.id)} onmouseleave={() => (hover = null)} onfocus={() => (hover = r.id)} onblur={() => (hover = null)} style="outline: none">
        <path d={r.shape} fill={hover === r.id ? "#f5c451" : "transparent"} fill-opacity="0.42" stroke={hover === r.id ? "#1c1917" : "transparent"} stroke-width="0.35" stroke-linejoin="round" style="cursor: pointer; transition: fill 120ms">
          <title>{r.name}</title>
        </path>
      </a>
    {/each}
  </svg>
</figure>
