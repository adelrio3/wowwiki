<script lang="ts">
  import type { Snippet } from "svelte";
  let { variant = "primary", href, type = "button", disabled = false, onclick, class: cls = "", children }: { variant?: "primary" | "secondary" | "quiet"; href?: string; type?: "button" | "submit"; disabled?: boolean; onclick?: () => void; class?: string; children: Snippet } = $props();
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:no-underline";
  const styles = {
    primary: "bg-btn text-btn-ink hover:bg-btn-hover hover:text-btn-ink",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:text-ink",
    quiet: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  };
</script>

{#if href}
  <a {href} class="{base} {styles[variant]} {cls}">{@render children()}</a>
{:else}
  <button {type} {disabled} {onclick} class="{base} {styles[variant]} {cls}">{@render children()}</button>
{/if}
