<script lang="ts">
  import "../app.css";
  import { SITE_NAME } from "$lib/config";
  let { data, children } = $props();
</script>

<div class="min-h-full flex flex-col">
  <header class="border-b border-stone-800 bg-stone-900/60">
    <nav class="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
      <a href="/" class="font-semibold tracking-wide text-amber-300 hover:text-amber-200">{SITE_NAME}</a>
      <a href="/wiki" class="text-stone-300 hover:text-white">World Wiki</a>
      <a href="/journal" class="text-stone-300 hover:text-white">Journal</a>
      <a href="/sync" class="text-stone-300 hover:text-white">Sync</a>
      <span class="flex-1"></span>
      {#if data.user}
        <a href="/account" class="text-stone-400 hover:text-white text-sm">{data.user.email}</a>
        <form method="post" action="/auth/signout"><button class="text-sm text-stone-400 hover:text-white">Sign out</button></form>
      {:else}
        <a href="/auth" class="text-sm">Sign in</a>
      {/if}
    </nav>
  </header>
  <main class="mx-auto w-full max-w-6xl px-4 py-8 flex-1">
    {@render children()}
  </main>
  <footer class="border-t border-stone-800 text-xs text-stone-500 px-4 py-4 text-center">
    World of Warcraft and all related content are property of Blizzard Entertainment. This is an unaffiliated fan project built from what players' clients saw.
  </footer>
</div>
