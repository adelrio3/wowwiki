<script lang="ts">
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import { untrack } from "svelte";
  let { data } = $props();
  let pending = $state(untrack(() => data.pending));
  let composed = $state(untrack(() => data.composed));
  let running = $state(false);
  let log = $state<string[]>([]);
  async function compose() {
    running = true;
    try {
      while (pending > 0) {
        const res = await fetch("/api/admin/compose-maps?flavor=era&batch=3", { method: "POST" });
        if (!res.ok) { log = [...log, `stopped: ${res.status} ${await res.text()}`]; break; }
        const r = (await res.json()) as { done: Array<{ mapId: number; pieces: number }>; failed: Array<{ mapId: number; error: string }>; remaining: number };
        for (const d of r.done) log = [...log, `map ${d.mapId}: composed with ${d.pieces} explored piece${d.pieces === 1 ? "" : "s"}`];
        for (const f of r.failed) log = [...log, `map ${f.mapId}: ${f.error}`];
        composed += r.done.length;
        pending = r.remaining;
        if (!r.done.length) break;
      }
    } finally { running = false; }
  }
</script>

<svelte:head><title>Admin · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-2xl">
  <PageHeader eyebrow="Owner" title="Admin" lede="Maintenance that only you can run." />
  <Card title="Zone maps">
    <p class="text-[14px] text-ink-muted">Maps are assembled from the layouts players' add-ons recorded and the files on Blizzard's content servers, then stored here. <span class="num">{composed}</span> composed, <span class="num">{pending}</span> waiting.</p>
    {#if data.locator}<p class="mt-1 text-[13px] text-ink-faint">File locator for build <span class="num">{data.locator.build}</span>, <span class="num">{data.locator.files.toLocaleString()}</span> map files known.</p>{:else}<p class="mt-1 text-[13px] text-warn">No file locator for this game version. Maps cannot be composed until one is added.</p>{/if}
    <div class="mt-3"><Button onclick={compose} disabled={running || pending === 0 || !data.locator}>{running ? "Composing…" : pending === 0 ? "Nothing to compose" : `Compose ${pending} map${pending === 1 ? "" : "s"}`}</Button></div>
    {#if log.length}<pre class="mt-3 max-h-64 overflow-auto rounded-lg bg-surface-2 p-3 text-xs">{log.join("\n")}</pre>{/if}
  </Card>
</div>
