<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { AddonManifest } from "@compendium/schema";
  import type { InstallState, SyncProgress, SyncReport } from "@compendium/sync-core";
  import { connectNew, reconnect, client, installStates, install, uninstall, sync, supportsFolderAccess, type Connection } from "$lib/sync/browser-sync";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";

  import { enhance } from "$app/forms";
  import { onDestroy } from "svelte";
  import type { HelperDevice } from "$lib/server/db/helpers";
  import { HELPER_DOWNLOAD_URL, HELPER_VERSION } from "$lib/config";
  let { data, form } = $props();

  // Helpers: the site is their dashboard (D-0043). Refresh while the page is open.
  let helpers = $state<HelperDevice[]>(untrack(() => data.helpers));
  const hasHelper = $derived(helpers.length > 0);
  const timer = setInterval(async () => {
    try { const r = await fetch("/api/helper/devices"); if (r.ok) helpers = ((await r.json()) as { helpers: HelperDevice[] }).helpers; } catch { /* keep the last state */ }
  }, 10000);
  onDestroy(() => clearInterval(timer));
  const ago = (iso: string | null | undefined) => { if (!iso) return "never"; const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(iso).toLocaleDateString(); };
  let browserOpen = $state(false);

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
    } catch (e) {
      const msg = String(e);
      error = /abort/i.test(msg) ? "Chrome did not open that folder. If it said the folder contains system files, the game is under Program Files; see the note above." : msg;
    } finally { busy = null; }
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

<svelte:head><title>Add-on · WoW Compendium</title></svelte:head>

{#snippet stepHead(n: number, title: string, state: "done" | "now" | "todo")}
  <div class="flex items-center gap-3">
    <span class="num grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium {state === 'done' ? 'bg-ok-soft text-ok' : state === 'now' ? 'bg-btn text-btn-ink' : 'border border-line text-ink-faint'}">{#if state === "done"}<Icon name="check" size={14} />{:else}{n}{/if}</span>
    <h2 class="text-[17px] font-semibold {state === 'todo' ? 'text-ink-faint' : ''}">{title}</h2>
  </div>
{/snippet}

<div class="mx-auto max-w-3xl">
  <PageHeader eyebrow="Contribute" title="Add-on" lede="It records what you see while you play, with no interface and no changes to your game. Two ways to install it and sync: the helper, or this page." />

  {#if hasHelper}
    <section class="mb-8 space-y-3">
      {#each helpers as h (h.id)}
        {@const st = h.state}
        {@const clients = st.clients ?? []}
        {@const allGood = h.online && !!st.folder && clients.length > 0 && clients.every((c) => c.installed && c.linked && !c.needsUpdate) && !st.lastError}
        <div class="card p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-[17px] font-semibold">{h.name}</h2>
              <p class="mt-0.5 text-[13px] text-ink-muted">{h.online ? "Running" : h.lastSeenAt ? `Last seen ${ago(h.lastSeenAt)}` : "Signed in, has not reported yet"}{h.helperVersion ? ` · helper ${h.helperVersion}` : ""}{st.paused ? " · paused" : ""}{#if h.helperVersion && h.helperVersion !== HELPER_VERSION} · <a href={HELPER_DOWNLOAD_URL}>update to {HELPER_VERSION}</a>{:else if !h.helperVersion} · <a href={HELPER_DOWNLOAD_URL}>install the latest helper</a> if this one is older than {HELPER_VERSION}{/if}</p>
            </div>
            <form method="post" action="?/helperSync" use:enhance><input type="hidden" name="device" value={h.id} /><Button type="submit" variant="secondary" disabled={!h.online}>{clients.some((c) => !c.installed || c.needsUpdate) ? "Install add-on and sync" : "Sync now"}</Button></form>
          </div>
          {#if form?.requested === h.id || h.pendingAction}<p class="mt-2 text-[13px] text-ink-muted">Asked. The helper picks this up within about twenty seconds.</p>{/if}
          <dl class="mt-3 grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-[max-content_1fr]">
            <dt class="text-ink-muted">Game folder</dt><dd class="mono text-[13px]">{st.folder ?? "not found yet: choose it in the helper window"}</dd>
            {#each clients as c (c.folder)}
              <dt class="text-ink-muted">Add-on in <span class="mono">{c.folder}</span></dt>
              <dd>{#if !c.installed}<span class="text-warn">not installed</span>{:else}<span class="num">{c.version ?? "?"}</span>{#if c.needsUpdate}<span class="ml-2 text-warn">update waiting</span>{/if}{#if !c.linked}<span class="ml-2 text-warn">not linked to your account</span>{/if}{/if}{#if (!c.installed || c.needsUpdate) && st.gameRunning} <span class="text-ink-faint">· installs when the game is closed</span>{/if}</dd>
            {/each}
            <dt class="text-ink-muted">Last upload</dt><dd>{ago(st.lastSync ?? h.lastUsedAt)}</dd>
            {#if st.lastError}<dt class="text-ink-muted">Last problem</dt><dd class="text-bad">{st.lastError}</dd>{/if}
          </dl>
          {#if allGood}<p class="mt-3 text-[14px] text-ok">Everything is set. Play, log out, and the helper uploads on its own.</p>{/if}
        </div>
      {/each}
      <div class="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p class="text-[14px] text-ink-muted">Another computer, or a fresh copy of the helper (version <span class="num">{HELPER_VERSION}</span>, Windows). Remove a helper from the Account page.</p>
        <Button href={HELPER_DOWNLOAD_URL} variant="secondary">Download the helper</Button>
      </div>
    </section>
  {:else}
    <section class="card mb-8 p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 max-w-xl">
          <h2 class="text-[17px] font-semibold">The helper <span class="ml-1 rounded-md bg-gold-soft px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gold">Recommended on Windows</span></h2>
          <p class="mt-1 text-[14px] text-ink-muted">A small app that sits in your tray. It finds your game folder, installs and updates the add-on, and uploads new data whenever the game saves it. Works wherever the game is installed, Program Files included. Sign in once; nothing else to do.</p>
          <ol class="mt-3 space-y-1 text-[14px] text-ink-muted">
            <li><span class="num mr-1.5 text-ink-faint">1</span>Download and run the installer. Windows shows a warning because the app is not signed: click <strong class="text-ink">More info</strong>, then <strong class="text-ink">Run anyway</strong>.</li>
            <li><span class="num mr-1.5 text-ink-faint">2</span>In the helper window click <strong class="text-ink">Sign in</strong>. Your browser opens this site; approve the code it shows.</li>
            <li><span class="num mr-1.5 text-ink-faint">3</span>That is all. Play, log out, and the helper syncs on its own. This page then shows what it is doing.</li>
          </ol>
        </div>
        <Button href={HELPER_DOWNLOAD_URL}>Download the helper for Windows</Button>
      </div>
    </section>
  {/if}

  {#if hasHelper}
    <details class="mb-4" bind:open={browserOpen}>
      <summary class="text-[14px] text-ink-muted">Sync from this page instead</summary>
      <p class="mb-4 mt-2 text-[14px] text-ink-muted">Works in Chrome, Edge and Brave when the game is installed outside Program Files. Not needed while a helper is running.</p>
    </details>
  {:else}
    <h2 class="mb-3 text-[17px] font-semibold">Or sync from this page</h2>
    <p class="mb-4 text-[14px] text-ink-muted">Works in Chrome, Edge and Brave when the game is installed outside Program Files.</p>
  {/if}

  {#if hasHelper && !browserOpen}
    <!-- browser path collapsed -->
  {:else if !supported}
    <Card><p class="text-[14px]">This browser can't open folders. Use <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Brave</strong> for one-click setup. A desktop helper for other browsers is coming.</p></Card>
  {:else}
    <ol class="space-y-4">
      <li class="card p-5">
        {@render stepHead(1, "Connect your World of Warcraft folder", conn ? "done" : "now")}
        <div class="mt-3 pl-10">
          {#if !conn}
            <div class="space-y-3">
              <Button onclick={connect} disabled={busy !== null}>{needsGesture ? "Resume access to your WoW folder" : "Choose folder"}</Button>
              <p class="text-[14px] text-ink-muted">Pick the folder that contains <code class="mono">_classic_era_</code>. If Chrome offers “Allow on every visit”, choose it so you never see the picker again.</p>
              <div class="rounded-lg bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-muted">
                <strong class="text-ink">Installed under Program Files?</strong> Chrome refuses to open anything there. Either wait for the desktop helper, which has no such limit and is coming next, or move the game folder (for example to <code class="mono">C:\Games\World of Warcraft</code>) and click “Locate” in Battle.net.
              </div>
            </div>
          {:else}
            <div class="flex flex-wrap items-center justify-between gap-3 text-[14px]">
              <div>Connected to <strong>{conn.fs.rootName}</strong> <span class="text-ink-muted">({conn.layout.kind === "root" ? "install root" : "one client folder"})</span></div>
              <Button variant="quiet" onclick={connect}>Change</Button>
            </div>
          {/if}
        </div>
      </li>

      <li class="card p-5">
        {@render stepHead(2, "Install the add-on", !conn ? "todo" : anyInstalled ? "done" : "now")}
        {#if conn}
          <div class="mt-3 pl-10">
            {#if conn.layout.flavors.length === 0}<p class="text-[14px] text-warn">No game client folders found in that folder.</p>{/if}
            <ul class="divide-y divide-line">
              {#each conn.layout.flavors as f (f.folder)}
                {@const st = states[f.folder]}
                <li class="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div class="min-w-0 flex-1">
                    <div class="mono text-[13px]">{f.folder} <span class="font-sans text-ink-muted">· {f.flavor}</span></div>
                    <div class="text-[13px] text-ink-muted">
                      {#if !st}checking…
                      {:else if !st.installed}not installed
                      {:else}version <span class="num">{st.version ?? "?"}</span>{#if st.version !== manifest?.version} · <span class="text-warn">update available ({manifest?.version})</span>{/if}{#if realDiff(st).length} · <span class="text-warn">files differ from release</span>{/if}{#if !st.linked} · <span class="text-warn">not linked</span>{/if}{/if}
                    </div>
                  </div>
                  {#if needsAction(st)}
                    <Button onclick={() => doInstall(f.folder)} disabled={busy !== null}>{st?.installed ? "Update" : "Install"}</Button>
                  {:else if st?.installed}
                    <Chip tone="ok"><Icon name="check" size={12} /> ready</Chip>
                  {/if}
                  {#if st?.installed}<Button variant="quiet" onclick={() => doUninstall(f.folder)} disabled={busy !== null}>Remove</Button>{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </li>

      <li class="card p-5">
        {@render stepHead(3, "Play, then log out", step === 2 ? "now" : step > 2 ? "done" : "todo")}
        <p class="mt-2 pl-10 text-[14px] text-ink-muted">Play as you normally would. The game saves the add-on's data only when you <strong class="text-ink">log out</strong> or type <code class="mono">/reload</code>, so do one of those before you sync.</p>
      </li>

      <li class="card p-5">
        {@render stepHead(4, "Sync", step >= 3 ? "done" : conn && anyInstalled ? "now" : "todo")}
        <div class="mt-3 pl-10">
          <div class="flex flex-wrap items-center gap-3">
            <Button onclick={doSync} disabled={busy !== null || !conn}>{busy === "sync" ? "Syncing…" : "Sync now"}</Button>
            <span class="text-[14px] text-ink-muted">Uploads anything new and tells the add-on it has been received.</span>
          </div>
          {#if report}
            <ul class="mt-3 space-y-1 text-[14px]">
              {#each report.results as r}
                <li class="flex flex-wrap gap-2">
                  <span class="mono text-ink-muted">{r.file.flavor.folder}</span>
                  {#if r.outcome === "uploaded"}<span class="text-ok">uploaded and ingested</span>{#if r.ack}<span class="text-ink-faint">· {Object.keys(r.ack).length} character{Object.keys(r.ack).length === 1 ? "" : "s"} acknowledged</span>{/if}
                  {:else if r.outcome === "already_synced"}<span class="text-ink-muted">already synced</span>
                  {:else if r.outcome === "unparseable"}<span class="text-bad">the data file could not be read. Update the add-on above, play again, log out, and sync.</span> <details class="inline text-ink-faint"><summary class="inline">details</summary>{r.error}</details>
                  {:else}<span class="text-bad">{r.outcome}{r.error ? `: ${r.error}` : ""}</span>{/if}
                </li>
              {/each}
              {#if report.results.length === 0}<li class="text-ink-muted">No data files found yet. Play a session, log out, then sync.</li>{/if}
            </ul>
          {/if}
        </div>
      </li>
    </ol>
  {/if}

  {#if error}<p class="mt-4 rounded-lg border border-bad/40 bg-bad-soft px-3.5 py-2.5 text-[14px] text-bad">{error}</p>{/if}
  {#if log.length}
    <details class="mt-4 text-xs text-ink-faint"><summary>Activity log</summary><pre class="mt-2 whitespace-pre-wrap">{log.join("\n")}</pre></details>
  {/if}

  <section class="mt-10">
    <h2 class="mb-3 text-[17px] font-semibold">Recent uploads</h2>
    <div class="card overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>When</th><th>Client</th><th>Status</th><th class="r">Observations</th></tr></thead>
        <tbody>
          {#each data.uploads as u}
            <tr><td class="whitespace-nowrap">{new Date(u.received_at).toLocaleString()}</td><td>{u.flavor}</td><td><Chip tone={u.ingest_status === "ingested" ? "ok" : u.ingest_status === "failed" ? "bad" : "neutral"}>{u.ingest_status}</Chip>{#if u.ingest_error}<span class="ml-2 text-bad">{u.ingest_error}</span>{/if}</td><td class="num r">{u.observation_count ?? ""}</td></tr>
          {/each}
          {#if data.uploads.length === 0}<tr><td colspan="4" class="text-ink-muted">Nothing uploaded yet.</td></tr>{/if}
        </tbody>
      </table>
    </div>
  </section>
</div>
