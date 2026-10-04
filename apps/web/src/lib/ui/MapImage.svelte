<script lang="ts">
  /** A composed zone map. Pins are optional and only used on pages about one thing (D-0040). */
  interface Pin { x: number; y: number; label: string; weight?: number; kind?: "spot" | "flight" }
  let { art, title, pins = [], class: cls = "" }: { art: { url: string; width: number; height: number }; title: string; pins?: Pin[]; class?: string } = $props();
  const r = (w = 1) => 0.9 + Math.min(1.6, Math.log2(1 + w) * 0.35);
</script>

<figure class="relative overflow-hidden rounded-xl border border-line bg-surface-2 shadow-card {cls}" style="aspect-ratio: {art.width} / {art.height}">
  <img src={art.url} width={art.width} height={art.height} alt={title} class="block h-full w-full object-cover" loading="lazy" decoding="async" />
  {#if pins.length}
    <svg viewBox="0 0 100 {(100 * art.height) / art.width}" class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {#each pins as p}
        {#if p.kind === "flight"}
          <g transform="translate({p.x * 100} {(p.y * 100 * art.height) / art.width})"><path d="M0 -2.4 L2.2 0 L0 2.4 L-2.2 0 Z" fill="#1c1917" stroke="#f5c451" stroke-width="0.5"><title>{p.label}</title></path></g>
        {:else}
          <circle cx={p.x * 100} cy={(p.y * 100 * art.height) / art.width} r={r(p.weight)} fill="#f5c451" stroke="#1c1917" stroke-width="0.35"><title>{p.label}</title></circle>
        {/if}
      {/each}
    </svg>
  {/if}
</figure>
