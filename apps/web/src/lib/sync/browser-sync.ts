/** Browser-side orchestration around @compendium/sync-core. */
import {
  HttpSyncClient,
  detectLayout,
  inspectInstall,
  installAddon,
  removeAddon,
  runSync,
  type FlavorFolder,
  type InstallState,
  type Layout,
  type SyncProgress,
  type SyncReport,
} from "@compendium/sync-core";
import { BrowserFileSystem, ensurePermission, pickWowFolder } from "@compendium/sync-core/browser";
import type { AddonManifest } from "@compendium/schema";
import { loadHandle, saveHandle } from "./handle-store";

export const supportsFolderAccess = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export interface Connection {
  fs: BrowserFileSystem;
  layout: Layout;
}

export async function connectNew(): Promise<Connection> {
  const fs = await pickWowFolder();
  await saveHandle((fs as unknown as { root: FileSystemDirectoryHandle }).root);
  return { fs, layout: await detectLayout(fs) };
}

/** Reconnect from a stored handle. Returns "prompt" when a user gesture is needed. */
export async function reconnect(requestIfNeeded: boolean): Promise<Connection | "prompt" | "none"> {
  const handle = await loadHandle();
  if (!handle) return "none";
  const h = handle as unknown as { queryPermission(o: { mode: string }): Promise<PermissionState> };
  const q = await h.queryPermission({ mode: "readwrite" });
  if (q !== "granted") {
    if (!requestIfNeeded) return "prompt";
    const p = await ensurePermission(handle);
    if (p !== "granted") return "prompt";
  }
  const fs = new BrowserFileSystem(handle);
  return { fs, layout: await detectLayout(fs) };
}

export function client(): HttpSyncClient {
  return new HttpSyncClient({ baseUrl: window.location.origin });
}

export async function installStates(conn: Connection, manifest: AddonManifest): Promise<Record<string, InstallState>> {
  const out: Record<string, InstallState> = {};
  for (const f of conn.layout.flavors) out[f.folder] = await inspectInstall(conn.fs, f, manifest);
  return out;
}

export async function install(conn: Connection, f: FlavorFolder, manifest: AddonManifest, accountToken: string): Promise<void> {
  const c = client();
  await installAddon(conn.fs, f, manifest, (p) => c.addonFile(manifest.version, p), { accountToken, preserveLinkAndAck: true });
}

export async function uninstall(conn: Connection, f: FlavorFolder): Promise<void> {
  await removeAddon(conn.fs, f);
}

export async function sync(conn: Connection, onProgress: (p: SyncProgress) => void): Promise<SyncReport> {
  return runSync(conn.fs, client(), { onProgress });
}
