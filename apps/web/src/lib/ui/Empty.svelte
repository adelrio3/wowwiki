<script lang="ts">
  let { text, href, action }: { text: string; href?: string; action?: string } = $props();
</script>

<div class="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
  <div>{text}</div>
  {#if href && action}<a {href} class="mt-2 inline-block">{action} →</a>{/if}
</div>
