<script lang="ts">
  /** An item's icon from our own copy of the client file; an empty frame while none is stored (D-0048). */
  let { url, name = "", size = 36, class: cls = "" }: { url: string | null; name?: string; size?: number; class?: string } = $props();
</script>

{#if url}
  <img src={url} alt="" width={size} height={size} loading="lazy" class="shrink-0 rounded-md border border-line-strong bg-surface-2 {cls}" style="width:{size}px;height:{size}px" title={name} />
{:else}
  <span class="inline-block shrink-0 rounded-md border border-dashed border-line-strong bg-surface-2 {cls}" style="width:{size}px;height:{size}px" aria-hidden="true"></span>
{/if}
