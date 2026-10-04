/**
 * WoW Compendium Helper. Runs sync-core over the Tauri file adapter, keeps
 * the add-on installed, and syncs when the game writes new data (docs/04
 * "The helper"). The tray is the main interface; this window shows status.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { HttpSyncClient, detectLayout, inspectInstall, installAddon, runSync, type InstallState, type Layout, type SyncReport } from "@compendium/sync-core";
import type { AddonManifest } from "@compendium/schema";
import { TauriFileSystem } from "./fs-tauri";
import { loadSettings, saveSettings, type Settings } from "./settings";

type Status = "setup" | "idle" | "syncing" | "paused" | "error";

const state = {
  settings: null as Settings | null,
  fs: null as TauriFileSystem | null,
  layout: null as Layout | null,
  installs: {} as Record<string, InstallState>,
  manifest: null as AddonManifest | null,
  status: "setup" as Status,
  statusText: "Starting",
  lastSync: null as Date | null,
  lastReport: null as SyncReport | null,
  signingIn: null as { code: string; url: string } | null,
  log: [] as string[],
  busy: false,
  /** per game client: what is happening right now, and the last result */
  clientBusy: {} as Record<string, string | null>,
  clientResult: {} as Record<string, { text: string; tone: "ok" | "bad" | "muted"; at: string }>,
  /** one-line notice at the top of the window, cleared after a few seconds */
  notice: null as { text: string; tone: "ok" | "bad" | "muted" } | null,
  folderBusy: false,
};
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
function notice(text: string, tone: "ok" | "bad" | "muted" = "muted", ms = 8000) {
  state.notice = { text, tone };
  render();
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { state.notice = null; render(); }, ms);
}
const clock = () => new Date().toLocaleTimeString([], { hour12: false });

const app = document.getElementById("app")!;
const log = (m: string) => { state.log = [...state.log.slice(-60), `${new Date().toLocaleTimeString([], { hour12: false })}  ${m}`]; render(); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const client = () => new HttpSyncClient({ baseUrl: state.settings!.siteUrl, deviceToken: state.settings!.deviceToken ?? undefined, fetch: tauriFetch as unknown as typeof fetch });

async function setStatus(status: Status, text: string) {
  state.status = status; state.statusText = text;
  render();
  await invoke("set_tray", { status: text, paused: state.settings?.paused ?? false, signedIn: !!state.settings?.deviceToken }).catch(() => {});
}

async function notify(title: string, body: string) {
  try {
    let ok = await isPermissionGranted();
    if (!ok) ok = (await requestPermission()) === "granted";
    if (ok) sendNotification({ title, body });
  } catch { /* notifications are optional */ }
}

// ---------------------------------------------------------------- folder
async function useFolder(path: string): Promise<boolean> {
  const fs = new TauriFileSystem(path);
  state.folderBusy = true; render();
  try {
    const layout = await detectLayout(fs);
    if (layout.kind === "unknown" || !layout.flavors.length) { log(`${path} does not look like a World of Warcraft folder.`); notice("That folder has no game client inside it. Pick the folder that contains _classic_era_.", "bad"); return false; }
    state.fs = fs; state.layout = layout;
    state.settings!.wowFolder = path;
    await saveSettings(state.settings!);
    log(`Game folder: ${path} (${layout.flavors.map((f) => f.folder).join(", ")})`);
    await startWatching();
    notice(`Game folder set: ${layout.flavors.map((f) => f.folder).join(", ")} found.`, "ok");
    return true;
  } catch (e) { log(`Cannot read ${path}: ${String(e)}`); notice(`Cannot read ${path}.`, "bad"); return false; }
  finally { state.folderBusy = false; render(); }
}

async function chooseFolder() {
  const picked = await openDialog({ directory: true, multiple: false, title: "Pick your World of Warcraft folder" });
  if (typeof picked === "string" && (await useFolder(picked))) void cycle("folder chosen");
}

async function detectFolder(): Promise<boolean> {
  const found = await invoke<string | null>("detect_wow_folder").catch(() => null);
  return found ? useFolder(found) : false;
}

// ---------------------------------------------------------------- sign-in
async function signIn() {
  if (state.signingIn) { await openUrl(state.signingIn.url); return; }
  const name = `Helper on ${state.settings!.deviceName || "this PC"}`;
  const res = await tauriFetch(`${state.settings!.siteUrl}/api/device/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  if (!res.ok) { log(`Sign-in could not start: ${res.status}`); return; }
  const { code, verifyUrl, pollSeconds } = (await res.json()) as { code: string; verifyUrl: string; pollSeconds: number };
  state.signingIn = { code, url: verifyUrl };
  render();
  await openUrl(verifyUrl);
  log(`Waiting for you to approve code ${code} in the browser.`);
  for (let i = 0; i < 200 && state.signingIn; i++) {
    await sleep((pollSeconds || 3) * 1000);
    const p = await tauriFetch(`${state.settings!.siteUrl}/api/device/poll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    if (!p.ok) continue;
    const r = (await p.json()) as { status: string; token?: string };
    if (r.status === "approved" && r.token) {
      state.settings!.deviceToken = r.token;
      await saveSettings(state.settings!);
      state.signingIn = null;
      log("Signed in.");
      await notify("WoW Compendium Helper", "Signed in. Syncing starts now.");
      void report();
      void cycle("signed in");
      return;
    }
    if (r.status === "expired" || r.status === "unknown") { state.signingIn = null; log("That sign-in code expired. Click Sign in again."); render(); return; }
  }
  state.signingIn = null; render();
}

async function signOut() {
  state.settings!.deviceToken = null;
  await saveSettings(state.settings!);
  log("Signed out. The add-on stays installed; nothing uploads until you sign in again.");
  await setStatus("setup", "Not signed in");
}

// ---------------------------------------------------------------- install
// Writing the add-on's files is safe while the game runs: the game reads
// add-ons at login, so a running game just needs a logout and login (D-0043,
// revised). Only the SavedVariables file is the game's to write.
async function installClient(folder: string): Promise<boolean> {
  const s = state.settings!;
  if (!s.deviceToken) { log("Sign in first: the add-on must be linked to your account."); notice("Sign in first. The add-on has to be linked to your account.", "bad"); return false; }
  if (!state.fs || !state.layout) { log("Choose the game folder first."); notice("Choose the game folder first.", "bad"); return false; }
  const f = state.layout.flavors.find((x) => x.folder === folder);
  if (!f) return false;
  if (state.clientBusy[folder]) return false;
  state.clientBusy[folder] = "Installing…"; render();
  try {
    const c = client();
    state.manifest = state.manifest ?? (await c.manifest());
    const r = await tauriFetch(`${s.siteUrl}/api/sync/link`, { headers: { authorization: `Bearer ${s.deviceToken}` } });
    if (!r.ok) throw new Error(`cannot read the account link (${r.status}); sign in again`);
    const linkToken = ((await r.json()) as { linkToken: string }).linkToken;
    const before = state.installs[folder];
    await installAddon(state.fs, f, state.manifest, (p) => c.addonFile(state.manifest!.version, p), { accountToken: linkToken, preserveLinkAndAck: true });
    state.installs[folder] = await inspectInstall(state.fs, f, state.manifest);
    const verb = !before?.installed ? "installed" : before.version === state.manifest.version ? "reinstalled" : "updated";
    const running = await invoke<boolean>("game_running").catch(() => false);
    log(`${folder}: add-on ${state.manifest.version} ${verb}.${running ? " The game is running: it loads at your next login." : ""}`);
    state.clientResult[folder] = { text: `${verb[0]!.toUpperCase()}${verb.slice(1)} ${state.manifest.version} at ${clock()}${running ? " · loads at next login" : ""}`, tone: "ok", at: clock() };
    notice(`${folder}: add-on ${state.manifest.version} ${verb}.`, "ok");
    return true;
  } catch (e) {
    log(`${folder}: install failed: ${String(e)}`);
    state.clientResult[folder] = { text: `Failed at ${clock()}: ${String(e)}`, tone: "bad", at: clock() };
    notice(`${folder}: install failed. See Activity.`, "bad");
    return false;
  } finally { state.clientBusy[folder] = null; render(); }
}

async function installAll(): Promise<void> {
  for (const f of state.layout?.flavors ?? []) await installClient(f.folder);
  void report();
}

// ---------------------------------------------------------------- sync
async function cycle(reason: string) {
  const s = state.settings!;
  if (state.busy) return;
  if (!s.deviceToken || !state.fs || !state.layout) { await setStatus("setup", !s.deviceToken ? "Not signed in" : "Choose the game folder"); return; }
  if (s.paused) { await setStatus("paused", "Paused"); return; }
  state.busy = true;
  try {
    await setStatus("syncing", "Syncing…");
    const c = client();
    state.manifest = await c.manifest();
    const gameRunning = await invoke<boolean>("game_running").catch(() => false);
    lastGameRunning = gameRunning;
    for (const f of state.layout.flavors) {
      const st = await inspectInstall(state.fs, f, state.manifest);
      state.installs[f.folder] = st;
      const needs = !st.installed || st.version !== state.manifest.version || !st.linked || st.differing.some((d) => !d.startsWith("Compendium_"));
      if (needs) await installClient(f.folder);
    }
    const report = await runSync(state.fs, c, { onProgress: (p) => { if (p.phase === "uploading" || p.phase === "failed") log(`${p.file.flavor.folder}: ${p.phase}${p.message ? " – " + p.message : ""}`); } });
    state.lastReport = report; state.lastSync = new Date();
    const uploaded = report.results.filter((r) => r.outcome === "uploaded").length;
    const failed = report.results.filter((r) => r.outcome === "failed" || r.outcome === "unparseable");
    const notLinked = report.results.filter((r) => r.outcome === "not_linked").length;
    for (const r of failed) log(`${r.file.flavor.folder}: ${r.outcome}${r.error ? " – " + r.error : ""}`);
    if (uploaded) { log(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} (${reason}).`); await notify("WoW Compendium", `Synced ${uploaded} file${uploaded === 1 ? "" : "s"}.`); }
    else if (!failed.length) log(report.results.length ? `Nothing new to upload (${reason}).` : `No game data found yet: log in on a character, then log out (${reason}).`);
    const summary = failed.length ? `${failed.length} file${failed.length === 1 ? "" : "s"} failed · ${clock()}`
      : notLinked ? `Add-on not linked to your account: reinstall it · ${clock()}`
      : uploaded ? `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} · ${clock()}`
      : report.results.length ? `Nothing new to upload · checked ${clock()}` : `No game data yet · checked ${clock()}`;
    if (reason !== "timer" && reason !== "startup") notice(summary, failed.length ? "bad" : uploaded ? "ok" : "muted");
    await setStatus(failed.length ? "error" : "idle", summary);
  } catch (e) {
    const msg = String(e);
    log(`Sync failed: ${msg}`);
    if (/401/.test(msg)) { state.settings!.deviceToken = null; await saveSettings(state.settings!); await setStatus("setup", "Signed out: sign in again"); }
    else await setStatus("error", "Sync failed");
  } finally { state.busy = false; render(); void report(); }
}

// ---------------------------------------------------------------- reporting
// The site is the helper's dashboard (D-0043): report state after every cycle
// and as a heartbeat, and pick up anything the site asked for.
let lastGameRunning = false;
async function report(): Promise<void> {
  const s = state.settings;
  if (!s?.deviceToken) return;
  const clients = (state.layout?.flavors ?? []).map((f) => { const st = state.installs[f.folder]; return { folder: f.folder, flavor: f.flavor, installed: !!st?.installed, version: st?.version ?? null, linked: !!st?.linked, needsUpdate: !!st && !!state.manifest && (st.version !== state.manifest.version || st.differing.some((d) => !d.startsWith("Compendium_"))) }; });
  const body = { helperVersion: __HELPER_VERSION__, state: { folder: s.wowFolder, clients: clients.map((c) => ({ ...c, busy: state.clientBusy[c.folder] ?? null, result: state.clientResult[c.folder]?.text ?? null })), lastSync: state.lastSync?.toISOString() ?? null, lastError: state.status === "error" ? state.statusText : null, paused: s.paused, gameRunning: lastGameRunning, status: state.statusText, busy: state.busy, recent: state.log.slice(-6) } };
  try {
    const r = await tauriFetch(`${s.siteUrl}/api/helper/status`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.deviceToken}` }, body: JSON.stringify(body) });
    if (r.status === 401) { s.deviceToken = null; await saveSettings(s); await setStatus("setup", "Signed out: sign in again"); return; }
    if (!r.ok) return;
    const { pendingAction } = (await r.json()) as { pendingAction: string | null };
    if (pendingAction) await runAction(pendingAction, "from the site");
  } catch { /* offline: try again next heartbeat */ }
}

// ---------------------------------------------------------------- actions
// The same actions exist in the window, the tray, and the site's Add-on page (D-0043).
async function runAction(action: string, origin: string): Promise<void> {
  if (action === "sync") { log(`Sync asked ${origin}.`); void cycle(origin); }
  else if (action === "install") { log(`Install asked ${origin}.`); void installAll(); }
  else if (action.startsWith("install:")) { log(`Install asked ${origin}.`); void installClient(action.slice(8)).then(() => report()); }
  else if (action === "pause" || action === "resume") { if ((action === "pause") !== !!state.settings!.paused) await togglePause(); }
}

// ---------------------------------------------------------------- watching
let unwatchers: UnwatchFn[] = [];
let debounce: ReturnType<typeof setTimeout> | null = null;
async function startWatching() {
  for (const u of unwatchers) u();
  unwatchers = [];
  if (!state.fs || !state.layout) return;
  for (const f of state.layout.flavors) {
    const dir = state.fs.abs(f.path ? `${f.path}/WTF/Account` : "WTF/Account");
    if (!(await state.fs.exists(f.path ? `${f.path}/WTF/Account` : "WTF/Account"))) continue;
    try {
      const un = await watch(dir, (ev) => {
        const paths = (ev as { paths?: string[] }).paths ?? [];
        if (!paths.some((p) => /WoWCompendium\.lua(\.bak)?$/i.test(p))) return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => void cycle("game saved new data"), 5000);
      }, { recursive: true, delayMs: 500 });
      unwatchers.push(un);
    } catch (e) { log(`Cannot watch ${dir}: ${String(e)}`); }
  }
}

// ---------------------------------------------------------------- ui
function render() {
  const s = state.settings;
  if (!s) { app.innerHTML = "<p class='muted'>Starting…</p>"; return; }
  const dot = state.status === "idle" ? "ok" : state.status === "syncing" ? "busy" : state.status === "error" ? "bad" : "";
  const flavors = state.layout?.flavors ?? [];
  const step = (n: number, done: boolean, title: string, right: string) => `<div class="row"><span><span class="num ${done ? "ok" : "muted"}" style="display:inline-block;width:1.4em">${done ? "✓" : n}</span>${title}</span><span>${right}</span></div>`;
  app.innerHTML = `
    <h1><span class="mark">&#9632;</span> WoW Compendium Helper <span class="faint" style="margin-left:auto">${__HELPER_VERSION__}${s.paused ? " · paused" : ""}</span></h1>
    ${state.notice ? `<div class="notice ${state.notice.tone}">${esc(state.notice.text)}</div>` : ""}
    <div class="card"><h2>Setup</h2>
      ${step(1, !!s.wowFolder && !!state.fs, state.folderBusy ? "Checking the folder…" : s.wowFolder ? `<span class="mono">${esc(s.wowFolder)}</span>` : "Game folder not found yet", `<button id="folder" class="secondary" ${state.folderBusy ? "disabled" : ""}>${s.wowFolder ? "Change" : "Choose folder"}</button>`)}
      ${step(2, !!s.deviceToken, s.deviceToken ? "Signed in" : state.signingIn ? `Approve code <span class="mono">${esc(state.signingIn.code)}</span> in your browser <span class="faint">(waiting…)</span>` : "Not signed in", s.deviceToken ? `<button id="signout" class="secondary">Sign out</button>` : state.signingIn ? `<button id="reopen" class="secondary">Open page again</button>` : `<button id="signin">Sign in</button>`)}
      ${flavors.length ? flavors.map((f) => { const st = state.installs[f.folder]; const busy = state.clientBusy[f.folder]; const res = state.clientResult[f.folder]; const current = !!st?.installed && !!state.manifest && st.version === state.manifest.version && st.linked;
        const line = busy ? `<span class="warn">${esc(busy)}</span>` : `<span class="${current ? "ok" : "warn"}">${st ? (st.installed ? `${st.version ?? "?"} installed${!st.linked ? ", not linked" : ""}${state.manifest && st.version !== state.manifest.version ? `, update to ${state.manifest.version}` : ""}` : "not installed") : "checking…"}</span>${res ? `<div class="faint ${res.tone === "bad" ? "bad" : ""}">${esc(res.text)}</div>` : ""}`;
        return step(3, current, `Add-on in <span class="mono">${esc(f.folder)}</span>: ${line}`, `<button class="install" data-folder="${esc(f.folder)}" ${!s.deviceToken || !state.fs || busy ? "disabled" : ""}>${busy ? "Working…" : st?.installed ? (current ? "Reinstall" : "Update add-on") : "Install add-on"}</button>`); }).join("") : step(3, false, "Add-on: waiting for the game folder", "")}
    </div>
    <div class="card"><h2>Status</h2>
      <div class="row"><span><span class="dot ${dot}"></span>${esc(state.statusText)}</span><span><button id="sync" ${state.busy || !s.deviceToken || !state.fs ? "disabled" : ""}>${state.busy ? "Syncing…" : "Sync now"}</button> <button id="pause" class="secondary">${s.paused ? "Resume" : "Pause"}</button></span></div>
      ${!s.deviceToken ? `<div class="faint">Sign in to enable installing and syncing.</div>` : ""}
    </div>
    <div class="card"><h2>Activity</h2><pre class="log">${esc(state.log.slice(-14).join("\n")) || "Nothing yet."}</pre></div>
    <div class="row"><span class="faint">Closing this window keeps the helper running in the tray. Use the tray menu to quit.</span><button id="site" class="secondary">Open WoW Compendium</button></div>`;
  app.querySelector("#site")?.addEventListener("click", () => void openUrl(`${s.siteUrl}/sync`));
  app.querySelectorAll<HTMLButtonElement>("button.install").forEach((b) => b.addEventListener("click", () => void installClient(b.dataset.folder!).then(() => report())));
  app.querySelector("#sync")?.addEventListener("click", () => void cycle("sync now"));
  app.querySelector("#pause")?.addEventListener("click", () => void togglePause());
  app.querySelector("#signin")?.addEventListener("click", () => void signIn());
  app.querySelector("#reopen")?.addEventListener("click", () => void signIn());
  app.querySelector("#signout")?.addEventListener("click", () => void signOut());
  app.querySelector("#folder")?.addEventListener("click", () => void chooseFolder());
}
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function togglePause() {
  state.settings!.paused = !state.settings!.paused;
  await saveSettings(state.settings!);
  if (state.settings!.paused) { await setStatus("paused", "Paused: nothing uploads until you resume"); notice("Paused.", "muted"); }
  else { notice("Resumed.", "ok"); void cycle("resumed"); }
  void report();
}

// ---------------------------------------------------------------- boot
async function boot() {
  state.settings = await loadSettings();
  if (!state.settings.deviceName) { state.settings.deviceName = (await invoke<string>("host_name").catch(() => "")) || "this PC"; await saveSettings(state.settings); }
  render();
  await listen<string>("tray", (e) => {
    switch (e.payload) {
      case "sync": void cycle("tray"); break;
      case "pause": void togglePause(); break;
      case "install": void installAll(); break;
      case "folder": void chooseFolder(); break;
      case "signin": if (state.settings?.deviceToken) void getCurrentWindow().show(); else void signIn(); break;
      case "site": void openUrl(state.settings!.siteUrl); break;
      case "show": void getCurrentWindow().show().then(() => getCurrentWindow().setFocus()); break;
    }
  });
  const folderOk = state.settings.wowFolder ? await useFolder(state.settings.wowFolder) : await detectFolder();
  const minimized = await invoke<boolean>("started_minimized").catch(() => false);
  if ((!folderOk || !state.settings.deviceToken) && !minimized) { await getCurrentWindow().show(); }
  try { if (!(await autostartEnabled())) await enableAutostart(); } catch { /* optional */ }
  await cycle("startup");
  setInterval(() => void cycle("timer"), 10 * 60 * 1000);
  setInterval(() => { if (!state.busy) void report(); }, 20 * 1000);
}
void boot();
