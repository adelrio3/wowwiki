<script lang="ts">
  let { text, href, action }: { text: string; href?: string; action?: string } = $props();
</script>

<div class="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-[14px] text-ink-muted">
  <div>{text}</div>
  {#if href && action}<a {href} class="mt-2 inline-block font-medium">{action} →</a>{/if}
</div>
