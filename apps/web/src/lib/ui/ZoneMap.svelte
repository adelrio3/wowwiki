<script lang="ts">
  /**
   * A continent map with one clickable region per zone (D-0046). Large zones
   * carry a small label; small ones (cities inside a zone) show their name on
   * hover, so labels do not pile up.
   */
  interface Region { id: number; name: string; href: string; x: number; y: number; w: number; h: number; recorded: boolean }
  let { art, title, regions, class: cls = "" }: { art: { url: string; width: number; height: number }; title: string; regions: Region[]; class?: string } = $props();
  const H = $derived((100 * art.height) / art.width);
  let hover = $state<number | null>(null);
  // Labels: largest zones first, and a label is skipped when it would sit on
  // one already placed (Eastern Kingdoms is narrow and crowded). Skipped zones
  // still show their name on hover and in the list beside the map.
  const FONT = 1.6;
  const labelled = $derived.by(() => {
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const out = new Set<number>();
    for (const r of [...regions].sort((a, b) => b.w * b.h - a.w * a.h)) {
      const w = r.name.length * FONT * 0.58 + 1, h = FONT * 1.3;
      const box = { x: (r.x + r.w / 2) * 100 - w / 2, y: (r.y + r.h / 2) * H - h / 2, w, h };
      if (placed.some((p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y)) continue;
      placed.push(box);
      out.add(r.id);
    }
    return out;
  });
</script>

<figure class="relative overflow-hidden rounded-xl border border-line bg-surface-2 shadow-card {cls}">
  <img src={art.url} width={art.width} height={art.height} alt={title} class="block h-full w-full object-cover" decoding="async" />
  <svg viewBox="0 0 100 {H}" class="absolute inset-0 h-full w-full" aria-label="Zones on this map" style="font-family: var(--font-sans)">
    {#each regions as r (r.id)}
      <a href={r.href} aria-label={r.name} onmouseenter={() => (hover = r.id)} onmouseleave={() => (hover = null)} onfocus={() => (hover = r.id)} onblur={() => (hover = null)} style="outline: none">
        <rect x={r.x * 100} y={r.y * H} width={r.w * 100} height={r.h * H} rx="0.6" fill={hover === r.id ? "#f5c451" : "transparent"} fill-opacity="0.3" stroke={hover === r.id ? "#1c1917" : "transparent"} stroke-width="0.25" stroke-dasharray="1 0.6" style="cursor: pointer">
          <title>{r.name}{r.recorded ? "" : " · nothing recorded yet"}</title>
        </rect>
        {#if labelled.has(r.id) || hover === r.id}
          <text x={(r.x + r.w / 2) * 100} y={(r.y + r.h / 2) * H} text-anchor="middle" dominant-baseline="middle" font-size={hover === r.id ? 2.2 : FONT} font-weight="600" fill="#1c1917" stroke="#fdf3d7" stroke-width="0.45" paint-order="stroke" style="pointer-events: none; letter-spacing: 0.02em">{r.name}</text>
        {/if}
      </a>
    {/each}
  </svg>
  {#if hover !== null}
    {@const r = regions.find((x) => x.id === hover)}
    {#if r}<figcaption class="pointer-events-none absolute bottom-2 left-2 rounded-md bg-surface/95 px-2 py-1 text-[13px] font-medium text-ink shadow-card">{r.name}{r.recorded ? "" : " · nothing recorded yet"}</figcaption>{/if}
  {/if}
</figure>
