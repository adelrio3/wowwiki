<script lang="ts">
  import { onMount } from "svelte";
  import type { AddonManifest } from "@compendium/schema";
  import type { InstallState, SyncProgress, SyncReport } from "@compendium/sync-core";
  import { connectNew, reconnect, client, installStates, install, uninstall, sync, supportsFolderAccess, type Connection } from "$lib/sync/browser-sync";
  import Badge from "$lib/ui/Badge.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import Stepper from "$lib/ui/Stepper.svelte";

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
  const realDiff = (st: InstallState) => st.differing.filter((d) => !d.startsWith("Compendium_"));
  const needsAction = (st: InstallState | undefined) => !!st && (!st.installed || st.version !== manifest?.version || realDiff(st).length > 0 || !st.linked);
  const anyInstalled = $derived(Object.values(states).some((s) => s.installed && !needsAction(s)));
  const step = $derived(!conn ? 0 : !anyInstalled ? 1 : report ? 3 : 2);

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

<svelte:head><title>Sync · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-8">
  <header>
    <h1 class="text-3xl font-medium">Sync</h1>
    <p class="text-ink-muted">Connect your World of Warcraft folder once. From then on this page installs and updates the add-on and uploads what your characters saw.</p>
  </header>

  <Stepper steps={["Connect folder", "Install add-on", "Play, then log out", "Sync"]} current={step} />

  {#if !supported}
    <Card>
      <p>This browser can't access folders. Use <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Brave</strong> for one-click setup. A desktop helper for other browsers is planned.</p>
    </Card>
  {:else}
    <Card title="1 · Your WoW folder">
      {#if !conn}
        <div class="space-y-3">
          <Button onclick={connect} disabled={busy !== null}>{needsGesture ? "Resume access to your WoW folder" : "Connect your WoW folder"}</Button>
          <p class="text-sm text-ink-muted">Pick the folder that contains <code class="mono">_classic_era_</code>, usually <code class="mono">C:\Program Files (x86)\World of Warcraft</code>. If Chrome offers “Allow on every visit”, choose it so you never see the picker again.</p>
        </div>
      {:else}
        <div class="flex items-center justify-between gap-3 text-sm">
          <div>Connected to <strong>{conn.fs.rootName}</strong> <span class="text-ink-muted">({conn.layout.kind === "root" ? "install root" : "one client folder"})</span></div>
          <Button variant="quiet" onclick={connect}>Change</Button>
        </div>
      {/if}
    </Card>

    {#if conn}
      <Card title="2 · Add-on per game client">
        {#if conn.layout.flavors.length === 0}
          <p class="text-sm text-warn">No game client folders found in that folder.</p>
        {/if}
        <ul class="divide-y divide-line">
          {#each conn.layout.flavors as f (f.folder)}
            {@const st = states[f.folder]}
            <li class="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div class="min-w-0 flex-1">
                <div class="mono text-sm">{f.folder} <span class="font-sans text-ink-muted">· {f.flavor}</span></div>
                <div class="text-sm text-ink-muted">
                  {#if !st}checking…
                  {:else if !st.installed}not installed
                  {:else}version <span class="num">{st.version ?? "?"}</span>{#if st.version !== manifest?.version} · <span class="text-warn">update available ({manifest?.version})</span>{/if}{#if realDiff(st).length} · <span class="text-warn">files differ from release</span>{/if}{#if !st.linked} · <span class="text-warn">not linked</span>{/if}{/if}
                </div>
              </div>
              {#if needsAction(st)}
                <Button onclick={() => doInstall(f.folder)} disabled={busy !== null}>{st?.installed ? "Update" : "Install"}</Button>
              {:else if st?.installed}
                <Badge status="confirmed" label="ready" />
              {/if}
              {#if st?.installed}
                <Button variant="quiet" onclick={() => doUninstall(f.folder)} disabled={busy !== null}>Remove</Button>
              {/if}
            </li>
          {/each}
        </ul>
      </Card>

      <Card title="3 · Play">
        <p class="text-sm text-ink-muted">Start the game and play as you normally would. The add-on has no interface. The game writes its data when you <strong>log out</strong> or type <code class="mono">/reload</code>, so do one of those before syncing.</p>
      </Card>

      <Card title="4 · Sync">
        <div class="flex flex-wrap items-center gap-3">
          <Button onclick={doSync} disabled={busy !== null}>{busy === "sync" ? "Syncing…" : "Sync now"}</Button>
          <span class="text-sm text-ink-muted">Uploads anything new and marks it acknowledged for the add-on.</span>
        </div>
        {#if report}
          <ul class="mt-3 space-y-1 text-sm">
            {#each report.results as r}
              <li class="flex flex-wrap gap-2">
                <span class="mono text-ink-muted">{r.file.flavor.folder}</span>
                {#if r.outcome === "uploaded"}<span class="text-ok">uploaded and ingested</span>{#if r.ack}<span class="text-ink-faint">· {Object.keys(r.ack).length} character{Object.keys(r.ack).length === 1 ? "" : "s"} acknowledged</span>{/if}
                {:else if r.outcome === "already_synced"}<span class="text-ink-muted">already synced</span>
                {:else if r.outcome === "unparseable"}<span class="text-bad">the data file could not be read. Update the add-on above, play again, log out, and sync.</span> <details class="inline text-ink-faint"><summary class="inline cursor-pointer">details</summary>{r.error}</details>
                {:else}<span class="text-bad">{r.outcome}{r.error ? `: ${r.error}` : ""}</span>{/if}
              </li>
            {/each}
            {#if report.results.length === 0}<li class="text-ink-muted">No data files found yet. Play a session, log out, then sync.</li>{/if}
          </ul>
        {/if}
      </Card>
    {/if}
  {/if}

  {#if error}<p class="rounded-md border border-bad/50 bg-surface px-3 py-2 text-sm text-bad">{error}</p>{/if}

  {#if log.length}
    <details class="text-xs text-ink-faint"><summary class="cursor-pointer">Activity log</summary><pre class="mt-2 whitespace-pre-wrap">{log.join("\n")}</pre></details>
  {/if}

  <Card title="Recent uploads">
    <table class="w-full text-sm">
      <thead class="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th class="py-1 font-medium">When</th><th class="font-medium">Client</th><th class="font-medium">Status</th><th class="font-medium">Observations</th></tr></thead>
      <tbody>
        {#each data.uploads as u}
          <tr class="border-t border-line"><td class="py-1.5">{new Date(u.received_at).toLocaleString()}</td><td>{u.flavor}</td><td><Badge status={u.ingest_status} />{#if u.ingest_error}<span class="ml-2 text-bad">{u.ingest_error}</span>{/if}</td><td class="num">{u.observation_count ?? ""}</td></tr>
        {/each}
        {#if data.uploads.length === 0}<tr><td colspan="4" class="py-2 text-ink-muted">Nothing uploaded yet.</td></tr>{/if}
      </tbody>
    </table>
  </Card>
</div>
