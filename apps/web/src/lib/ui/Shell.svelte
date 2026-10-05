<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { SITE_NAME } from "$lib/config";
  import Icon from "./Icon.svelte";
  import { currentTheme, setTheme, type Theme } from "./theme";

  let { user, isAdmin = false, children }: { user: { email?: string } | null; isAdmin?: boolean; children: Snippet } = $props();
  let theme = $state<Theme>("light");
  let open = $state(false);
  let searchEl = $state<HTMLInputElement | null>(null);
  onMount(() => {
    theme = currentTheme();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) { e.preventDefault(); searchEl?.focus(); }
      if (e.key === "Escape") open = false;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const toggle = () => { theme = theme === "dark" ? "light" : "dark"; setTheme(theme); };
  $effect(() => { page.url.pathname; open = false; });

  const world = [
    { href: "/wiki", label: "Zones", icon: "map", exact: true },
    { href: "/wiki/npcs", label: "NPCs", icon: "user" },
    { href: "/wiki/creatures", label: "Creatures", icon: "paw" },
    { href: "/wiki/items", label: "Items", icon: "bag" },
    { href: "/wiki/areas", label: "Areas", icon: "pin" },
  ] as const;
  const you = [
    { href: "/journal", label: "Journal", icon: "journal" },
    { href: "/sync", label: "Add-on", icon: "plug" },
  ] as const;
  const active = (href: string, exact = false) => {
    const p = page.url.pathname;
    if (exact) return p === href || (href === "/wiki" && /^\/wiki\/[a-z]+\/zone\//.test(p));
    if (href === "/wiki/npcs" || href === "/wiki/creatures") return p === href || (p.includes("/creature/") && page.data?.kind === (href === "/wiki/npcs" ? "NPC" : "Creature"));
    if (href === "/wiki/items") return p === href || /^\/wiki\/[a-z]+\/item\//.test(p);
    return p === href || p.startsWith(href + "/");
  };
  const item = "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] hover:no-underline";
</script>

{#snippet navlink(n: { href: string; label: string; icon: "map" | "user" | "paw" | "pin" | "bag" | "journal" | "plug"; exact?: boolean })}
  {@const on = active(n.href, n.exact)}
  <a href={n.href} class="{item} {on ? 'bg-surface-2 font-medium text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}" aria-current={on ? "page" : undefined}>
    <Icon name={n.icon} size={16} class={on ? "text-gold" : "text-ink-faint"} />
    <span>{n.label}</span>
  </a>
{/snippet}

{#snippet sidebar()}
  <div class="flex h-full flex-col gap-5 px-3 py-4">
    <a href="/" class="flex items-center gap-2.5 px-2 text-ink hover:text-ink hover:no-underline">
      <span class="grid size-8 place-items-center rounded-lg bg-gold-soft text-gold"><Icon name="book" size={18} /></span>
      <span class="serif text-[17px] leading-none">{SITE_NAME}</span>
    </a>

    <form action="/wiki" class="px-1">
      <label class="sr-only" for="site-search">Search the wiki</label>
      <div class="relative">
        <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"><Icon name="search" size={15} /></span>
        <input bind:this={searchEl} id="site-search" name="q" type="search" placeholder="Search" autocomplete="off" class="field pl-8 pr-9 py-1.5" />
        <kbd class="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[11px] text-ink-faint lg:block">/</kbd>
      </div>
    </form>

    <div class="px-1">
      <label class="eyebrow mb-1 block px-1.5" for="game-version">Game version</label>
      <div class="relative">
        <select id="game-version" class="field appearance-none py-1.5 pr-8">
          <option>Classic Era · 1.15.9</option>
          <option disabled>Anniversary · soon</option>
          <option disabled>Retail · soon</option>
        </select>
        <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-ink-faint"><Icon name="chevron" size={14} /></span>
      </div>
    </div>

    <nav class="space-y-5" aria-label="Site">
      <div>
        <div class="eyebrow mb-1 px-3">World</div>
        <div class="space-y-0.5">{#each world as n}{@render navlink(n)}{/each}</div>
      </div>
      <div>
        <div class="eyebrow mb-1 px-3">You</div>
        <div class="space-y-0.5">{#each you as n}{@render navlink(n)}{/each}</div>
      </div>
    </nav>

    <div class="mt-auto space-y-1 border-t border-line pt-3">
      {#if user}
        <a href="/account" class="{item} {active('/account') ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}"><Icon name="account" size={16} class="text-ink-faint" /><span class="truncate">{user.email}</span></a>
        {#if isAdmin}<a href="/admin" class="{item} {active('/admin') ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}"><Icon name="sparkle" size={16} class="text-ink-faint" /><span>Admin</span></a>{/if}
        <form method="post" action="/auth/signout"><button class="{item} w-full text-ink-muted hover:bg-surface-2 hover:text-ink"><span class="w-4"></span>Sign out</button></form>
      {:else}
        <a href="/auth" class="{item} text-ink-muted hover:bg-surface-2 hover:text-ink"><Icon name="account" size={16} class="text-ink-faint" /><span>Sign in</span></a>
      {/if}
      <button onclick={toggle} class="{item} w-full text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Toggle light and dark theme">
        <Icon name={theme === "dark" ? "sun" : "moon"} size={16} class="text-ink-faint" /><span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
      </button>
    </div>
  </div>
{/snippet}

<div class="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
  <aside class="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">
    {@render sidebar()}
  </aside>

  <div class="flex min-h-screen min-w-0 flex-col">
    <header class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
      <button onclick={() => (open = true)} class="rounded-lg p-2 text-ink-muted hover:bg-surface-2" aria-label="Open menu"><Icon name="menu" size={20} /></button>
      <a href="/" class="flex items-center gap-2 text-ink hover:text-ink hover:no-underline"><span class="grid size-7 place-items-center rounded-md bg-gold-soft text-gold"><Icon name="book" size={16} /></span><span class="serif text-[16px]">{SITE_NAME}</span></a>
      <form action="/wiki" class="ml-auto min-w-0 flex-1 max-w-[12rem]">
        <label class="sr-only" for="site-search-m">Search</label>
        <input id="site-search-m" name="q" type="search" placeholder="Search" class="field py-1.5" />
      </form>
    </header>

    <main class="w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
      {@render children()}
    </main>
    <footer class="px-4 py-5 text-xs text-ink-faint sm:px-8 lg:px-12">
      World of Warcraft and all related content are property of Blizzard Entertainment. An unaffiliated fan project built from what players' clients saw.
    </footer>
  </div>

  {#if open}
    <div class="fixed inset-0 z-30 lg:hidden">
      <button class="absolute inset-0 bg-ink/40" aria-label="Close menu" onclick={() => (open = false)}></button>
      <div class="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] bg-surface shadow-xl">
        <button onclick={() => (open = false)} class="absolute right-2 top-3 rounded-lg p-2 text-ink-muted hover:bg-surface-2" aria-label="Close menu"><Icon name="x" size={18} /></button>
        {@render sidebar()}
      </div>
    </div>
  {/if}
</div>
