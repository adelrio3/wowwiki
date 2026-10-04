<script lang="ts">
  let { data } = $props();
</script>

<section class="space-y-6 max-w-3xl">
  <h1 class="text-3xl font-bold">A wiki written by the world itself.</h1>
  <p class="text-stone-300">
    Every page here was observed in a real player's game client by our add-on. Nothing is imported from anywhere else.
    Install the add-on, play, and what you see becomes part of the record. Your own journey stays private in your Journal
    unless you choose to share it.
  </p>
  <div class="flex gap-3">
    <a href="/sync" class="rounded bg-amber-500 px-4 py-2 font-medium text-stone-950 hover:bg-amber-400 hover:text-stone-950">Get the add-on</a>
    <a href="/wiki" class="rounded border border-stone-700 px-4 py-2 hover:border-stone-500">Browse the wiki</a>
  </div>
  <div class="grid gap-4 sm:grid-cols-3 text-sm">
    <div class="rounded border border-stone-800 p-4"><div class="text-2xl font-semibold">{data.counts.creatures}</div><div class="text-stone-400">creatures observed</div></div>
    <div class="rounded border border-stone-800 p-4"><div class="text-2xl font-semibold">{data.counts.areas}</div><div class="text-stone-400">areas mapped</div></div>
    <div class="rounded border border-stone-800 p-4"><div class="text-2xl font-semibold">{data.counts.contributors}</div><div class="text-stone-400">contributors</div></div>
  </div>
</section>
