<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { SITE_NAME } from "$lib/config";
  import { currentTheme, setTheme, type Theme } from "./theme";

  let { user, children }: { user: { email?: string } | null; children: Snippet } = $props();
  let theme = $state<Theme>("light");
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
  <header class="sticky top-0 z-20 border-b border-line bg-surface">
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-5 sm:px-6">
      <a href="/" class="flex items-center gap-2 font-semibold tracking-tight text-ink hover:text-ink hover:no-underline">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-accent" aria-hidden="true"><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" /><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" /></svg>
        <span>{SITE_NAME}</span>
      </a>
      <nav class="hidden items-center gap-1 sm:flex">
        {#each nav as n}
          <a href={n.href} class="rounded-md px-2.5 py-1.5 text-sm font-medium hover:no-underline {active(n.href) ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}">{n.label}</a>
        {/each}
      </nav>
      <form action="/wiki" class="ml-auto min-w-0 flex-1 sm:max-w-sm">
        <label class="sr-only" for="site-search">Search the wiki</label>
        <div class="relative">
          <svg class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="site-search" name="q" type="search" placeholder="Search creatures, zones, areas" class="w-full rounded-md border border-line bg-bg py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none" />
        </div>
      </form>
      <button onclick={toggle} class="rounded-md border border-line p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Toggle light and dark theme" title="Theme">
        {#if theme === "dark"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        {/if}
      </button>
      {#if user}
        <a href="/account" class="hidden text-sm text-ink-muted hover:text-ink md:inline">{user.email}</a>
        <form method="post" action="/auth/signout"><button class="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink">Sign out</button></form>
      {:else}
        <a href="/auth" class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-strong hover:text-accent-ink hover:no-underline">Sign in</a>
      {/if}
    </div>
    <nav class="flex gap-1 border-t border-line px-2 py-1 sm:hidden">
      {#each nav as n}
        <a href={n.href} class="rounded-md px-2.5 py-1 text-sm font-medium hover:no-underline {active(n.href) ? 'bg-surface-2 text-ink' : 'text-ink-muted'}">{n.label}</a>
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
