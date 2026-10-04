<script lang="ts">
  let { status, label, class: cls = "" }: { status?: string; label?: string; class?: string } = $props();
  const tone: Record<string, string> = {
    unconfirmed: "border-line text-ink-muted",
    confirmed: "border-ok/50 text-ok",
    disputed: "border-warn/60 text-warn",
    retired: "border-line text-ink-faint",
    overridden: "border-info/60 text-info",
    failed: "border-bad/60 text-bad",
    ingested: "border-ok/50 text-ok",
    received: "border-line text-ink-muted",
    ingesting: "border-warn/60 text-warn",
    duplicate: "border-line text-ink-muted",
  };
  const text: Record<string, string> = { overridden: "corrected" };
</script>

<span class="inline-flex items-center rounded-sm border px-1.5 py-px text-[11px] font-medium uppercase tracking-wide leading-4 {tone[status ?? ''] ?? 'border-line text-ink-muted'} {cls}">{label ?? text[status ?? ""] ?? status}</span>
