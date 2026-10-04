/**
 * Hand-maintained game metadata. This is OUR reference data, not imported game
 * data: which client is which flavor, which build is which patch and
 * expansion, folder names, region and locale codes.
 *
 * Add rows as builds appear. The ingest function flags unknown builds for an
 * administrator to classify (docs/02).
 */
import type { Flavor } from "@compendium/schema";

export type { Flavor };

/** WOW_PROJECT_ID values observed or documented per client. */
export const PROJECT_IDS: Record<number, Flavor> = {
  1: "retail",
  2: "era",
  5: "anniversary", // VERIFY: TBC Anniversary client project id
  14: "mists", // Cataclysm Classic project id; progression client (not currently running)
  19: "mists",
};

export function flavorFromProjectId(projectId: number, folder?: string): Flavor | undefined {
  if (folder) {
    const byFolder = flavorFromFolder(folder);
    if (byFolder) return byFolder;
  }
  return PROJECT_IDS[projectId];
}

/** Install folder names per flavor, as found under the World of Warcraft root. */
export const FLAVOR_FOLDERS: Record<Flavor, string[]> = {
  era: ["_classic_era_"],
  anniversary: ["_anniversary_"],
  mists: ["_classic_"],
  retail: ["_retail_"],
  forever: ["_classic_beta_", "_forever_"], // launch folder name unverified
};

export function flavorFromFolder(folder: string): Flavor | undefined {
  for (const [flavor, names] of Object.entries(FLAVOR_FOLDERS) as [Flavor, string[]][]) {
    if (names.includes(folder)) return flavor;
  }
  return undefined;
}

/** TOC suffix per flavor. Anniversary and Forever: VERIFY at first run. */
export const TOC_SUFFIX: Record<Flavor, string> = {
  era: "_Vanilla",
  anniversary: "_TBC",
  mists: "_Mists",
  retail: "_Mainline",
  forever: "_Forever",
};

export const EXPANSIONS = [
  "Classic",
  "The Burning Crusade",
  "Wrath of the Lich King",
  "Cataclysm",
  "Mists of Pandaria",
  "Warlords of Draenor",
  "Legion",
  "Battle for Azeroth",
  "Shadowlands",
  "Dragonflight",
  "The War Within",
  "Midnight",
  "Forever",
] as const;
export type Expansion = (typeof EXPANSIONS)[number];

export interface BuildRow {
  flavor: Flavor;
  build: number;
  patch: string;
  expansion: Expansion;
  /** interface version from the TOC / GetBuildInfo */
  interface?: number;
  /** release date as ISO yyyy-mm-dd when known */
  releasedAt?: string;
}

/** Known builds. First row verified by the owner's client on 2026-10-03. */
export const BUILDS: BuildRow[] = [
  { flavor: "era", build: 70003, patch: "1.15.9", expansion: "Classic", interface: 11509, releasedAt: "2026-09-23" },
];

export function findBuild(flavor: Flavor, build: number): BuildRow | undefined {
  return BUILDS.find((b) => b.flavor === flavor && b.build === build);
}

/**
 * Best-effort expansion for a build we have not classified yet, from the
 * version string's major number. Used for display only until an admin
 * classifies the build; the fact's build interval stays exact regardless.
 */
export function guessExpansion(flavor: Flavor, version: string): Expansion {
  const major = Number(version.split(".")[0] ?? 0);
  if (flavor === "forever") return "Forever";
  switch (major) {
    case 1: return "Classic";
    case 2: return "The Burning Crusade";
    case 3: return "Wrath of the Lich King";
    case 4: return "Cataclysm";
    case 5: return "Mists of Pandaria";
    case 6: return "Warlords of Draenor";
    case 7: return "Legion";
    case 8: return "Battle for Azeroth";
    case 9: return "Shadowlands";
    case 10: return "Dragonflight";
    case 11: return "The War Within";
    case 12: return "Midnight";
    default: return "Classic";
  }
}

/** GetCurrentRegion() ids. */
export const REGIONS: Record<number, string> = { 1: "US", 2: "KR", 3: "EU", 4: "TW", 5: "CN" };

export const LOCALES = ["enUS", "enGB", "deDE", "esES", "esMX", "frFR", "itIT", "koKR", "ptBR", "ruRU", "zhCN", "zhTW"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "enUS";

/** Enum.UIMapType as the client reports it. */
export const UI_MAP_TYPES: Record<number, string> = {
  0: "cosmic",
  1: "world",
  2: "continent",
  3: "zone",
  4: "dungeon",
  5: "micro",
  6: "orphan",
};

/** UnitReaction values. */
export const REACTIONS: Record<number, string> = {
  1: "hated",
  2: "hostile",
  3: "unfriendly",
  4: "neutral",
  5: "friendly",
  6: "honored",
  7: "revered",
  8: "exalted",
};

/** Parse a creature/object/player GUID into its parts. */
export interface ParsedGuid {
  kind: string;
  /** npcID or objectID for Creature/GameObject/Vehicle/Pet GUIDs */
  id?: number;
  serverId?: number;
  instanceId?: number;
  zoneUid?: number;
  spawnUid?: string;
  /** realm id and player uid for Player GUIDs */
  realmId?: number;
  playerUid?: string;
}

export function parseGuid(guid: string): ParsedGuid | undefined {
  const m = guid.match(/^(Creature|Vehicle|Pet|GameObject)-0-(\d+)-(\d+)-(\d+)-(\d+)-([0-9A-Fa-f]+)$/);
  if (m) {
    return { kind: m[1]!, serverId: Number(m[2]), instanceId: Number(m[3]), zoneUid: Number(m[4]), id: Number(m[5]), spawnUid: m[6] };
  }
  const p = guid.match(/^Player-(\d+)-([0-9A-Fa-f]+)$/);
  if (p) return { kind: "Player", realmId: Number(p[1]), playerUid: p[2] };
  const i = guid.match(/^Item-(\d+)-0-([0-9A-Fa-f]+)$/);
  if (i) return { kind: "Item", realmId: Number(i[1]), playerUid: i[2] };
  return undefined;
}
