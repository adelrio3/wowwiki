/**
 * Install, verify, update, and remove the add-on; write the link and ack files.
 */
import type { AddonManifest } from "@compendium/schema";
import { joinPath, sha256Hex, type FileSystemAdapter } from "./adapter.js";
import { ACK_FILE, INSTALLED_MANIFEST, LINK_FILE, addonPath, type FlavorFolder } from "./layout.js";
import { luaGlobalFile } from "./lua-writer.js";

export type FetchAddonFile = (path: string) => Promise<Uint8Array>;

export interface InstallState {
  installed: boolean;
  /** version from the installed manifest.json, if any */
  version?: string;
  /** true when any file differs from the release manifest's hash */
  modified: boolean;
  /** files whose hash differed or were missing */
  differing: string[];
  linked: boolean;
}

export async function inspectInstall(fs: FileSystemAdapter, f: FlavorFolder, release: AddonManifest): Promise<InstallState> {
  const dir = addonPath(f);
  if (!(await fs.exists(dir))) return { installed: false, modified: false, differing: [], linked: false };
  let version: string | undefined;
  try {
    const m = JSON.parse(await fs.readText(joinPath(dir, INSTALLED_MANIFEST))) as { version?: string };
    version = m.version;
  } catch {
    version = undefined;
  }
  const differing: string[] = [];
  for (const file of release.files) {
    const p = joinPath(dir, file.path);
    if (!(await fs.exists(p))) {
      differing.push(file.path);
      continue;
    }
    const hash = await sha256Hex(await fs.readBytes(p));
    if (hash !== file.sha256) differing.push(file.path);
  }
  const linked = await isLinked(fs, f);
  return { installed: true, version, modified: differing.length > 0, differing, linked };
}

async function isLinked(fs: FileSystemAdapter, f: FlavorFolder): Promise<boolean> {
  const p = joinPath(addonPath(f), LINK_FILE);
  if (!(await fs.exists(p))) return false;
  const text = await fs.readText(p);
  return /account_token/.test(text) && !/account_token"\]\s*=\s*""/.test(text);
}

/** Write (or rewrite) every file in the release manifest. */
export async function installAddon(
  fs: FileSystemAdapter,
  f: FlavorFolder,
  release: AddonManifest,
  fetchFile: FetchAddonFile,
  options: { accountToken?: string; preserveLinkAndAck?: boolean; settings?: AddonSettings } = {},
): Promise<void> {
  const dir = addonPath(f);
  await ensureDir(fs, joinPath(f.path, "Interface"));
  await ensureDir(fs, joinPath(f.path, "Interface", "AddOns"));
  await ensureDir(fs, dir);
  const preserve = new Set(options.preserveLinkAndAck ? [LINK_FILE, ACK_FILE] : []);
  for (const file of release.files) {
    if (preserve.has(file.path) && (await fs.exists(joinPath(dir, file.path)))) continue;
    const parts = file.path.split("/");
    for (let i = 1; i < parts.length; i++) await ensureDir(fs, joinPath(dir, ...parts.slice(0, i)));
    const bytes = await fetchFile(file.path);
    const hash = await sha256Hex(bytes);
    if (hash !== file.sha256) throw new Error(`downloaded ${file.path} does not match the release manifest`);
    await fs.writeBytes(joinPath(dir, file.path), bytes);
  }
  await fs.writeText(joinPath(dir, INSTALLED_MANIFEST), JSON.stringify(release, null, 2));
  if (options.accountToken) await writeLinkFile(fs, f, options.accountToken, options.settings);
}

export async function removeAddon(fs: FileSystemAdapter, f: FlavorFolder): Promise<void> {
  const dir = addonPath(f);
  if (await fs.exists(dir)) await fs.remove(dir, { recursive: true });
}

/** Add-on settings carried in the link file. None are defined yet; the add-on
 *  never changes client settings (D-0036), so settings only ever tune capture. */
export type AddonSettings = Record<string, never>;

export async function writeLinkFile(fs: FileSystemAdapter, f: FlavorFolder, accountToken: string, settings: AddonSettings = {}): Promise<void> {
  const text = luaGlobalFile(
    "COMPENDIUM_LINK",
    { account_token: accountToken, linked_at: Math.floor(Date.now() / 1000), settings: { ...settings } },
    "Written by WoW Compendium. Links this add-on's data to your account. Do not share.",
  );
  await fs.writeText(joinPath(addonPath(f), LINK_FILE), text);
}

export async function writeAckFile(fs: FileSystemAdapter, f: FlavorFolder, ack: Record<string, number>): Promise<void> {
  const obj: Record<string, number> = {};
  for (const [guid, seq] of Object.entries(ack)) if (Number.isInteger(seq) && seq >= 0) obj[guid] = seq;
  const text = luaGlobalFile(
    "COMPENDIUM_ACK",
    obj,
    "Written by WoW Compendium after each sync. Highest ingested session per character.",
  );
  await fs.writeText(joinPath(addonPath(f), ACK_FILE), text);
}

/** Read the current ack file so a new sync only ever raises values. */
export async function readAckFile(fs: FileSystemAdapter, f: FlavorFolder): Promise<Record<string, number>> {
  const p = joinPath(addonPath(f), ACK_FILE);
  if (!(await fs.exists(p))) return {};
  const text = await fs.readText(p);
  const out: Record<string, number> = {};
  for (const m of text.matchAll(/\["([^"]+)"\]\s*=\s*(\d+)/g)) out[m[1]!] = Number(m[2]);
  return out;
}

async function ensureDir(fs: FileSystemAdapter, path: string): Promise<void> {
  if (!(await fs.exists(path))) await fs.mkdir(path);
}
