<script lang="ts">
  import { onMount } from "svelte";
  import type { AddonManifest } from "@compendium/schema";
  import type { InstallState, SyncProgress, SyncReport } from "@compendium/sync-core";
  import { connectNew, reconnect, client, installStates, install, uninstall, sync, supportsFolderAccess, type Connection } from "$lib/sync/browser-sync";

  let { data } = $props();

  let supported = $state(true);
  let conn = $state<Connection | null>(null);
  let needsGesture = $state(false);
  let manifest = $state<AddonManifest | null>(null);
  let states = $state<Record<string, InstallState>>({});
  let busy = $state<string | null>(null);
  let log = $state<string[]>([]);
  let report = $state<SyncReport | null>(null);
  let error = $state<string | null>(null);

  const push = (m: string) => (log = [...log, m]);

  async function refresh() {
    if (!conn) return;
    if (!manifest) manifest = await client().manifest();
    states = await installStates(conn, manifest);
  }

  onMount(async () => {
    supported = supportsFolderAccess();
    if (!supported) return;
    try {
      const r = await reconnect(false);
      if (r === "prompt") needsGesture = true;
      else if (r !== "none") { conn = r; await refresh(); }
    } catch (e) { error = String(e); }
  });

  async function connect() {
    error = null; busy = "connect";
    try {
      const r = needsGesture ? await reconnect(true) : null;
      conn = r && r !== "prompt" && r !== "none" ? r : await connectNew();
      needsGesture = false;
      await refresh();
      if (conn.layout.kind === "unknown") error = "That folder doesn't look like a World of Warcraft install. Pick the folder that contains _classic_era_ or _retail_.";
    } catch (e) { error = String(e); } finally { busy = null; }
  }

  async function doInstall(folder: string) {
    if (!conn || !manifest || !data.linkToken) return;
    busy = folder; error = null;
    try {
      const f = conn.layout.flavors.find((x) => x.folder === folder)!;
      await install(conn, f, manifest, data.linkToken);
      await refresh();
      push(`Installed add-on ${manifest.version} into ${folder}. Restart the game if it is running.`);
    } catch (e) { error = String(e); } finally { busy = null; }
  }

  async function doUninstall(folder: string) {
    if (!conn) return;
    busy = folder;
    try {
      const f = conn.layout.flavors.find((x) => x.folder === folder)!;
      await uninstall(conn, f);
      await refresh();
      push(`Removed add-on from ${folder}.`);
    } catch (e) { error = String(e); } finally { busy = null; }
  }

  async function doSync() {
    if (!conn) return;
    busy = "sync"; error = null; report = null;
    try {
      report = await sync(conn, (p: SyncProgress) => push(`${p.file.flavor.folder}: ${p.phase}${p.message ? " – " + p.message : ""}`));
    } catch (e) { error = String(e); } finally { busy = null; }
  }
</script>

<section class="space-y-8 max-w-3xl">
  <div>
    <h1 class="text-2xl font-bold">Sync</h1>
    <p class="text-stone-300 mt-2">Connect your World of Warcraft folder once. From then on this page installs and updates the add-on and uploads what your characters saw.</p>
  </div>

  {#if !supported}
    <div class="rounded border border-amber-800 bg-amber-950/30 p-4">
      <p>This browser can't access folders. Use Chrome, Edge, or Brave for one-click setup. The desktop helper for other browsers is coming in a later release.</p>
    </div>
  {:else if !conn}
    <button onclick={connect} disabled={busy !== null} class="rounded bg-amber-500 px-4 py-2 font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-50">
      {needsGesture ? "Resume access to your WoW folder" : "Connect your WoW folder"}
    </button>
    <p class="text-sm text-stone-400">Pick the folder that contains <code>_classic_era_</code> (usually <code>C:\Program Files (x86)\World of Warcraft</code>). Choose "Allow on every visit" if Chrome offers it.</p>
  {:else}
    <div class="rounded border border-stone-800 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>Connected to <strong>{conn.fs.rootName}</strong> ({conn.layout.kind === "root" ? "install root" : "one client folder"})</div>
        <button onclick={connect} class="text-sm text-stone-400 hover:text-white">Change folder</button>
      </div>
      {#if conn.layout.flavors.length === 0}
        <p class="text-amber-300">No game client folders found here.</p>
      {/if}
      {#each conn.layout.flavors as f (f.folder)}
        {@const st = states[f.folder]}
        <div class="flex items-center gap-4 border-t border-stone-800 pt-3">
          <div class="flex-1">
            <div class="font-medium">{f.folder} <span class="text-stone-400 text-sm">({f.flavor})</span></div>
            <div class="text-sm text-stone-400">
              {#if !st}checking…{:else if !st.installed}add-on not installed{:else}add-on {st.version ?? "?"} installed{#if st.differing.filter((d) => !d.startsWith("Compendium_")).length} (files differ from release){/if}{#if !st.linked} · not linked{/if}{/if}
            </div>
          </div>
          {#if st && (!st.installed || st.version !== manifest?.version || st.differing.filter((d) => !d.startsWith("Compendium_")).length || !st.linked)}
            <button onclick={() => doInstall(f.folder)} disabled={busy !== null} class="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-50">{st?.installed ? "Update" : "Install"}</button>
          {/if}
          {#if st?.installed}
            <button onclick={() => doUninstall(f.folder)} disabled={busy !== null} class="rounded border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-500 disabled:opacity-50">Remove</button>
          {/if}
        </div>
      {/each}
    </div>

    <div class="space-y-2">
      <button onclick={doSync} disabled={busy !== null} class="rounded bg-amber-500 px-4 py-2 font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-50">{busy === "sync" ? "Syncing…" : "Sync now"}</button>
      <p class="text-sm text-stone-400">The game writes its data when you log out or type <code>/reload</code>. Sync after that.</p>
    </div>

    {#if report}
      <div class="rounded border border-stone-800 p-4 text-sm space-y-1">
        {#each report.results as r}
          <div>
            <span class="text-stone-400">{r.file.flavor.folder}</span>:
            {#if r.outcome === "uploaded"}uploaded and ingested{#if r.ack} · acknowledged {Object.keys(r.ack).length} character(s){/if}
            {:else if r.outcome === "already_synced"}already synced
            {:else if r.outcome === "unparseable"}<span class="text-red-400">the data file could not be read. Update the add-on above, play again, log out, and sync.</span> <details class="inline text-stone-500"><summary class="inline cursor-pointer">details</summary>{r.error}</details>
            {:else}<span class="text-red-400">{r.outcome}{r.error ? ": " + r.error : ""}</span>{/if}
          </div>
        {/each}
        {#if report.results.length === 0}<div>No data files found yet. Play a session, log out, then sync.</div>{/if}
      </div>
    {/if}
  {/if}

  {#if error}<p class="text-red-400">{error}</p>{/if}

  {#if log.length}
    <details class="text-xs text-stone-500"><summary>Activity</summary><pre class="whitespace-pre-wrap">{log.join("\n")}</pre></details>
  {/if}

  <div>
    <h2 class="text-lg font-semibold">Recent uploads</h2>
    <table class="mt-2 w-full text-sm">
      <thead class="text-stone-400 text-left"><tr><th class="py-1">When</th><th>Client</th><th>Status</th><th>Observations</th></tr></thead>
      <tbody>
        {#each data.uploads as u}
          <tr class="border-t border-stone-800"><td class="py-1">{new Date(u.received_at).toLocaleString()}</td><td>{u.flavor}</td><td class={u.ingest_status === "failed" ? "text-red-400" : ""}>{u.ingest_status}{u.ingest_error ? " – " + u.ingest_error : ""}</td><td>{u.observation_count ?? ""}</td></tr>
        {/each}
        {#if data.uploads.length === 0}<tr><td colspan="4" class="py-2 text-stone-500">Nothing uploaded yet.</td></tr>{/if}
      </tbody>
    </table>
  </div>
</section>
