<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { SITE_NAME } from "$lib/config";
  import { currentTheme, setTheme, type Theme } from "./theme";

  let { user, children }: { user: { email?: string } | null; children: Snippet } = $props();
  let theme = $state<Theme>("dark");
  onMount(() => { theme = currentTheme(); });
  const toggle = () => { theme = theme === "dark" ? "light" : "dark"; setTheme(theme); };
  const nav = [
    { href: "/wiki", label: "World Wiki" },
    { href: "/journal", label: "Journal" },
    { href: "/sync", label: "Sync" },
  ];
  const active = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + "/");
</script>

<div class="flex min-h-screen flex-col">
  <header class="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 sm:px-6">
      <a href="/" class="display text-lg font-medium tracking-tight text-ink hover:text-ink hover:no-underline">{SITE_NAME}</a>
      <nav class="hidden items-center gap-1 sm:flex">
        {#each nav as n}
          <a href={n.href} class="rounded-md px-2.5 py-1.5 text-sm hover:no-underline {active(n.href) ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink'}">{n.label}</a>
        {/each}
      </nav>
      <form action="/wiki" class="ml-auto flex-1 sm:max-w-xs">
        <label class="sr-only" for="site-search">Search the wiki</label>
        <input id="site-search" name="q" type="search" placeholder="Search the wiki" class="w-full rounded-md border border-line bg-bg px-3 py-1.5 text-sm placeholder:text-ink-faint focus:border-gold focus:outline-none" />
      </form>
      <button onclick={toggle} class="rounded-md border border-line p-1.5 text-ink-muted hover:text-ink" aria-label="Toggle light and dark theme" title="Theme">
        {#if theme === "dark"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        {/if}
      </button>
      {#if user}
        <a href="/account" class="hidden text-sm text-ink-muted hover:text-ink sm:inline">{user.email}</a>
        <form method="post" action="/auth/signout"><button class="text-sm text-ink-muted hover:text-ink">Sign out</button></form>
      {:else}
        <a href="/auth" class="text-sm">Sign in</a>
      {/if}
    </div>
    <nav class="flex gap-1 border-t border-line px-2 py-1 sm:hidden">
      {#each nav as n}
        <a href={n.href} class="rounded-md px-2.5 py-1 text-sm hover:no-underline {active(n.href) ? 'bg-surface-2 text-ink' : 'text-ink-muted'}">{n.label}</a>
      {/each}
    </nav>
  </header>
  <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
    {@render children()}
  </main>
  <footer class="border-t border-line px-4 py-4 text-center text-xs text-ink-faint">
    World of Warcraft and all related content are property of Blizzard Entertainment. An unaffiliated fan project built from what players' clients saw.
  </footer>
</div>
