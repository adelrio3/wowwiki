<script lang="ts">
  let { status, label, class: cls = "" }: { status?: string; label?: string; class?: string } = $props();
  const tone: Record<string, string> = {
    unconfirmed: "bg-neutral-soft text-ink-muted",
    confirmed: "bg-ok-soft text-ok",
    disputed: "bg-warn-soft text-warn",
    retired: "bg-neutral-soft text-ink-faint",
    overridden: "bg-info-soft text-info",
    failed: "bg-bad-soft text-bad",
    ingested: "bg-ok-soft text-ok",
    received: "bg-neutral-soft text-ink-muted",
    ingesting: "bg-warn-soft text-warn",
    duplicate: "bg-neutral-soft text-ink-muted",
    npc: "bg-info-soft text-info",
    creature: "bg-neutral-soft text-ink-muted",
  };
  const text: Record<string, string> = { overridden: "corrected" };
</script>

<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-4 {tone[status ?? ''] ?? 'bg-neutral-soft text-ink-muted'} {cls}">{label ?? text[status ?? ""] ?? status}</span>
