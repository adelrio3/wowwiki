import { REACTIONS } from "@compendium/game-meta";

export const STATUS_LABEL: Record<string, string> = {
  unconfirmed: "unconfirmed",
  confirmed: "confirmed",
  disputed: "disputed",
  retired: "retired",
  overridden: "corrected",
};

export function reactionLabel(r: number | undefined): string {
  return r === undefined ? "unknown" : (REACTIONS[r] ?? String(r));
}

export const CLASSIFICATION_LABEL: Record<string, string> = {
  normal: "Normal",
  elite: "Elite",
  rare: "Rare",
  rareelite: "Rare Elite",
  worldboss: "World Boss",
  trivial: "Trivial",
  minus: "Minor",
};

/**
 * NPC or creature (D-0038). An NPC is a person in the world: anyone with an
 * interaction role or a tooltip title, anyone the game flags as a civilian or
 * as not attackable, or anyone some observer saw as friendly. Everything else
 * is a creature. Signals are observer-relative, so any single positive signal
 * from any contributor is enough.
 */
export interface KindSignals {
  roles: string[];
  subtitle?: string | null;
  civilian?: boolean;
  notAttackable?: boolean;
  friendlyToAnyone?: boolean;
}
export function unitKind(s: KindSignals): "NPC" | "Creature" {
  if (s.roles.length || s.subtitle || s.civilian || s.notAttackable || s.friendlyToAnyone) return "NPC";
  return "Creature";
}

/** "<Owner>'s Pet" marks a creature that fights for someone; it is not a person. */
const PET_SUBTITLE = /['\u2019]s Pet$/i;

export function kindSignalsFromFacts(facts: Array<{ field: string; value_kind: string; value_num: number | null; value_text: string | null; value_json: unknown }>): KindSignals {
  return {
    roles: facts.filter((f) => f.field.startsWith("role:")).map((f) => f.field.slice(5)),
    subtitle: facts.find((f) => f.field === "subtitle" && f.value_text && !PET_SUBTITLE.test(f.value_text))?.value_text ?? null,
    civilian: facts.some((f) => f.field === "civilian" && f.value_num === 1),
    notAttackable: facts.some((f) => f.field === "attackable" && f.value_num === 0),
    friendlyToAnyone: facts.some((f) => f.field === "reaction" && ((f.value_json as { reaction?: number })?.reaction ?? 0) >= 5),
  };
}

/** A sentence about how well an entity's facts are supported (D-0039). */
export function evidence(status: string, contributors: number): { text: string; tone: "ok" | "warn" | "info" | "neutral" } {
  const n = Math.max(contributors, 1);
  const players = `${n} player${n === 1 ? "" : "s"}`;
  switch (status) {
    case "confirmed": return { text: `Confirmed by ${players}.`, tone: "ok" };
    case "disputed": return { text: `${players} reported this, and some details disagree.`, tone: "warn" };
    case "overridden": return { text: "Corrected by a moderator.", tone: "info" };
    case "retired": return { text: "Not seen in recent builds.", tone: "neutral" };
    default: return { text: `Reported by ${players}. Not yet confirmed by a second.`, tone: "neutral" };
  }
}

/** Map coordinates the way the game shows them: "47, 60" out of 100. */
export function coord(x: number | null, y: number | null): string {
  if (x === null || y === null) return "";
  return `${(x * 100).toFixed(0)}, ${(y * 100).toFixed(0)}`;
}

export function levelRange(min: number | null, max: number | null): string {
  if (min === null) return "";
  return max === null || max === min ? String(min) : `${min}–${max}`;
}

export const ROLE_LABEL: Record<string, string> = { gossip: "Talks", quest: "Quest giver", quest_end: "Quest turn-in", vendor: "Vendor", trainer: "Trainer", taxi: "Flight master", bank: "Banker", innkeeper: "Innkeeper", stable_master: "Stable master", auctioneer: "Auctioneer", mailbox: "Mail", spirit_healer: "Spirit healer", battlemaster: "Battlemaster", guild_bank: "Guild bank", guild_registrar: "Guild registrar", tabard_vendor: "Tabard vendor", petition_vendor: "Petition vendor" };

export function titleCase(s: string | null | undefined): string {
  return s ? s[0]!.toUpperCase() + s.slice(1).toLowerCase() : "";
}

/** Item quality as the game names it, 0 to 7, with the colour token each uses (docs/12). */
export const QUALITY: Array<{ label: string; cls: string }> = [
  { label: "Poor", cls: "text-q0" },
  { label: "Common", cls: "text-q1" },
  { label: "Uncommon", cls: "text-q2" },
  { label: "Rare", cls: "text-q3" },
  { label: "Epic", cls: "text-q4" },
  { label: "Legendary", cls: "text-q5" },
  { label: "Artifact", cls: "text-q6" },
  { label: "Heirloom", cls: "text-q7" },
];
export const qualityLabel = (q: number | null | undefined) => (q === null || q === undefined ? "" : (QUALITY[q]?.label ?? `Quality ${q}`));
export const qualityClass = (q: number | null | undefined) => (q === null || q === undefined ? "text-ink" : (QUALITY[q]?.cls ?? "text-ink"));

/** Where an item is worn, from the client's INVTYPE token. */
export const EQUIP_LOC: Record<string, string> = {
  INVTYPE_HEAD: "Head", INVTYPE_NECK: "Neck", INVTYPE_SHOULDER: "Shoulder", INVTYPE_BODY: "Shirt", INVTYPE_CHEST: "Chest", INVTYPE_ROBE: "Chest", INVTYPE_WAIST: "Waist",
  INVTYPE_LEGS: "Legs", INVTYPE_FEET: "Feet", INVTYPE_WRIST: "Wrist", INVTYPE_HAND: "Hands", INVTYPE_FINGER: "Finger", INVTYPE_TRINKET: "Trinket", INVTYPE_CLOAK: "Back",
  INVTYPE_WEAPON: "One-Hand", INVTYPE_SHIELD: "Off Hand", INVTYPE_2HWEAPON: "Two-Hand", INVTYPE_WEAPONMAINHAND: "Main Hand", INVTYPE_WEAPONOFFHAND: "Off Hand",
  INVTYPE_HOLDABLE: "Held In Off-hand", INVTYPE_RANGED: "Ranged", INVTYPE_RANGEDRIGHT: "Ranged", INVTYPE_THROWN: "Thrown", INVTYPE_AMMO: "Ammo", INVTYPE_RELIC: "Relic",
  INVTYPE_TABARD: "Tabard", INVTYPE_BAG: "Bag", INVTYPE_QUIVER: "Quiver",
};
export const equipLabel = (eq: string | null | undefined) => (eq ? (EQUIP_LOC[eq] ?? eq.replace(/^INVTYPE_/, "").toLowerCase()) : "");

export const BIND_LABEL: Record<number, string> = { 1: "Binds when picked up", 2: "Binds when equipped", 3: "Binds when used", 4: "Quest item" };

/** Copper as the game shows money: "1g 23s 45c" parts, highest first, zeros skipped. */
export function money(copper: number | null | undefined): Array<{ n: number; unit: "g" | "s" | "c" }> {
  if (copper === null || copper === undefined || copper < 0) return [];
  const g = Math.floor(copper / 10000), s = Math.floor((copper % 10000) / 100), c = copper % 100;
  const parts: Array<{ n: number; unit: "g" | "s" | "c" }> = [];
  if (g) parts.push({ n: g, unit: "g" });
  if (s) parts.push({ n: s, unit: "s" });
  if (c || !parts.length) parts.push({ n: c, unit: "c" });
  return parts;
}

/** A drop rate as players read it: whole percent, "<1%" below one, never "0%" for something seen. */
export function dropRate(numerator: number, denominator: number): string {
  if (!denominator) return "";
  const pct = (100 * numerator) / denominator;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return "<1%";
}

/**
 * How a captured tooltip line reads: the game colours "Use:", "Equip:" and
 * "Chance on hit:" green, set names and requirements by state, flavour text
 * in gold. We keep the semantics with our own tokens (docs/12).
 */
export function tooltipTone(line: string): "effect" | "flavour" | "muted" | "plain" {
  if (/^(Use|Equip|Chance on hit|Set):/i.test(line)) return "effect";
  if (/^"/.test(line)) return "flavour";
  if (/^(Requires|Durability|Sell Price|Unique|Soulbound|Binds |Quest Item|Classes:|Races:|Item Level)/i.test(line)) return "muted";
  return "plain";
}
