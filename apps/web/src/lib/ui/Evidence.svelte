<script lang="ts">
  /** One readable sentence about how well a fact is supported, instead of a status badge. */
  import Icon from "./Icon.svelte";
  import { evidence } from "$lib/wiki-format";
  let { status, contributors, class: cls = "" }: { status: string; contributors: number; class?: string } = $props();
  const e = $derived(evidence(status, contributors));
</script>

<div class="flex items-start gap-2 text-[13px] {e.tone === 'ok' ? 'text-ok' : e.tone === 'warn' ? 'text-warn' : e.tone === 'info' ? 'text-info' : 'text-ink-muted'} {cls}">
  <Icon name={e.tone === "ok" ? "check" : e.tone === "warn" ? "alert" : "clock"} size={15} class="mt-0.5 shrink-0" />
  <span>{e.text}</span>
</div>
