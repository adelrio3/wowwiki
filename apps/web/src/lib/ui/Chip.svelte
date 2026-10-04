<script lang="ts">
  let { tone = "neutral", class: cls = "", children }: { tone?: "neutral" | "gold" | "ok" | "warn" | "bad" | "info"; class?: string; children: import("svelte").Snippet } = $props();
  const tones = { neutral: "bg-surface-2 text-ink-muted", gold: "bg-gold-soft text-gold", ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", info: "bg-info-soft text-info" };
</script>

<span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium leading-4 {tones[tone]} {cls}">{@render children()}</span>
