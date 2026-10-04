/**
 * Where things live inside a World of Warcraft install (docs/04).
 *
 *   <root>/_classic_era_/Interface/AddOns/WoWCompendium/
 *   <root>/_classic_era_/WTF/Account/<ACCOUNT>/SavedVariables/WoWCompendium.lua
 */
import { FLAVOR_FOLDERS, flavorFromFolder } from "@compendium/game-meta";
import type { Flavor } from "@compendium/schema";
import { joinPath, type FileSystemAdapter } from "./adapter.js";

export const ADDON_FOLDER = "WoWCompendium";
export const SAVEDVARIABLES_FILE = "WoWCompendium.lua";
export const LINK_FILE = "Compendium_Link.lua";
export const ACK_FILE = "Compendium_Ack.lua";
export const INSTALLED_MANIFEST = "manifest.json";

export interface FlavorFolder {
  flavor: Flavor;
  /** folder name such as "_classic_era_" */
  folder: string;
  /** path relative to the adapter root; "" when the root IS the flavor folder */
  path: string;
}

export interface Layout {
  kind: "root" | "flavor" | "unknown";
  flavors: FlavorFolder[];
}

const ALL_FOLDERS = Object.values(FLAVOR_FOLDERS).flat();

/** Detect whether the chosen folder is the WoW root or one flavor folder. */
export async function detectLayout(fs: FileSystemAdapter): Promise<Layout> {
  const entries = await fs.list("");
  const dirs = new Set(entries.filter((e) => e.kind === "directory").map((e) => e.name));
  const flavors: FlavorFolder[] = [];
  for (const folder of ALL_FOLDERS) {
    if (dirs.has(folder)) {
      const flavor = flavorFromFolder(folder);
      if (flavor) flavors.push({ flavor, folder, path: folder });
    }
  }
  if (flavors.length > 0) return { kind: "root", flavors };

  if (dirs.has("Interface") && dirs.has("WTF")) {
    const folder = fs.rootName ?? "";
    const flavor = flavorFromFolder(folder);
    if (flavor) return { kind: "flavor", flavors: [{ flavor, folder, path: "" }] };
    return { kind: "flavor", flavors: [] };
  }
  return { kind: "unknown", flavors: [] };
}

export function addonPath(f: FlavorFolder): string {
  return joinPath(f.path, "Interface", "AddOns", ADDON_FOLDER);
}

export interface SavedVariablesLocation {
  flavor: FlavorFolder;
  /** path to WoWCompendium.lua relative to the adapter root */
  path: string;
  /** the WoW account folder name; used only to tell files apart locally, never uploaded */
  accountFolder: string;
}

/** Every WoWCompendium.lua under WTF/Account/<ACCOUNT>/SavedVariables/. */
export async function findSavedVariables(fs: FileSystemAdapter, f: FlavorFolder): Promise<SavedVariablesLocation[]> {
  const accountsDir = joinPath(f.path, "WTF", "Account");
  if (!(await fs.exists(accountsDir))) return [];
  const out: SavedVariablesLocation[] = [];
  for (const entry of await fs.list(accountsDir)) {
    if (entry.kind !== "directory" || entry.name === "SavedVariables") continue;
    const path = joinPath(accountsDir, entry.name, "SavedVariables", SAVEDVARIABLES_FILE);
    if (await fs.exists(path)) out.push({ flavor: f, path, accountFolder: entry.name });
  }
  return out;
}
