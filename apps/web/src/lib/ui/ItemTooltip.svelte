<script lang="ts">
  /**
   * The item as the game's own tooltip showed it, line for line, so a player
   * recognises it at once (D-0048). Lines keep the game's meaning with our
   * tokens: effects in green, flavour text in gold, requirements muted.
   */
  import ItemIcon from "./ItemIcon.svelte";
  import { qualityClass, tooltipTone } from "$lib/wiki-format";
  let { name, quality, lines, iconUrl, class: cls = "" }: { name: string; quality: number | null; lines: string[]; iconUrl: string | null; class?: string } = $props();
  const body = $derived(lines.length && lines[0] === name ? lines.slice(1) : lines);
  const tone = { effect: "text-ok", flavour: "text-gold italic", muted: "text-ink-muted", plain: "text-ink" } as const;
</script>

<div class="card max-w-md px-4 py-3 {cls}">
  <div class="flex items-start gap-3">
    <ItemIcon url={iconUrl} {name} size={44} />
    <div class="min-w-0">
      <p class="text-[17px] font-semibold leading-tight {qualityClass(quality)}">{name}</p>
      {#if body.length}
        <ul class="mt-1.5 space-y-0.5 text-[14px] leading-snug">
          {#each body as line}
            {#if line.trim()}<li class={tone[tooltipTone(line)]}>{line}</li>{/if}
          {/each}
        </ul>
      {:else}
        <p class="mt-1.5 text-[13px] text-ink-faint">No tooltip recorded yet.</p>
      {/if}
    </div>
  </div>
</div>
