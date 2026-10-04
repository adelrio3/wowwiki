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
