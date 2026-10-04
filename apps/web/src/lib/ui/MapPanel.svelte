<script lang="ts">
  export interface MapPoint {
    x: number;
    y: number;
    label: string;
    href?: string;
    weight?: number;
  }
  let { points, title, caption }: { points: MapPoint[]; title?: string; caption?: string } = $props();
  const W = 1000, H = 667;
  const r = (w = 1) => 4 + Math.min(8, Math.log2(1 + w) * 2);
</script>

<figure class="overflow-hidden rounded-md border border-line bg-surface">
  {#if title}<figcaption class="border-b border-line px-3 py-2 text-sm font-medium">{title}</figcaption>{/if}
  <svg viewBox="0 0 {W} {H}" class="block w-full bg-surface-2" role="img" aria-label={title ?? "map"}>
    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as i}
      <line x1={(W * i) / 10} y1="0" x2={(W * i) / 10} y2={H} stroke="var(--line)" stroke-width="1" />
      <line x1="0" y1={(H * i) / 10} x2={W} y2={(H * i) / 10} stroke="var(--line)" stroke-width="1" />
      <text x={(W * i) / 10 + 4} y="14" font-size="11" fill="var(--ink-faint)" class="mono">{i * 10}</text>
      <text x="4" y={(H * i) / 10 - 4} font-size="11" fill="var(--ink-faint)" class="mono">{i * 10}</text>
    {/each}
    {#each points as p}
      {#if p.href}
        <a href={p.href}>
          <circle cx={p.x * W} cy={p.y * H} r={r(p.weight)} fill="var(--accent)" fill-opacity="0.9" stroke="var(--surface)" stroke-width="1.5">
            <title>{p.label} · {(p.x * 100).toFixed(1)}, {(p.y * 100).toFixed(1)}</title>
          </circle>
        </a>
      {:else}
        <circle cx={p.x * W} cy={p.y * H} r={r(p.weight)} fill="var(--accent)" fill-opacity="0.9" stroke="var(--surface)" stroke-width="1.5">
          <title>{p.label} · {(p.x * 100).toFixed(1)}, {(p.y * 100).toFixed(1)}</title>
        </circle>
      {/if}
    {/each}
  </svg>
  {#if caption}<div class="px-3 py-1.5 text-xs text-ink-faint">{caption}</div>{/if}
</figure>
