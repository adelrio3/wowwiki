<script lang="ts">
  import type { Snippet } from "svelte";
  let {
    variant = "primary",
    href,
    type = "button",
    disabled = false,
    onclick,
    class: cls = "",
    children,
  }: { variant?: "primary" | "secondary" | "quiet"; href?: string; type?: "button" | "submit"; disabled?: boolean; onclick?: () => void; class?: string; children: Snippet } = $props();
  const base = "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const styles = {
    primary: "bg-accent text-accent-ink hover:bg-accent-strong hover:text-accent-ink hover:no-underline",
    secondary: "border border-line bg-surface text-ink hover:bg-surface-2 hover:text-ink hover:no-underline",
    quiet: "text-ink-muted hover:text-ink hover:bg-surface-2 hover:no-underline",
  };
</script>

{#if href}
  <a {href} class="{base} {styles[variant]} {cls}">{@render children()}</a>
{:else}
  <button {type} {disabled} {onclick} class="{base} {styles[variant]} {cls}">{@render children()}</button>
{/if}
