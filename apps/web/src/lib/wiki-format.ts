import { REACTIONS } from "@compendium/game-meta";

export const STATUS_LABEL: Record<string, string> = {
  unconfirmed: "unconfirmed",
  confirmed: "confirmed",
  disputed: "disputed",
  retired: "retired",
  overridden: "corrected",
};

export const STATUS_CLASS: Record<string, string> = {
  unconfirmed: "border-stone-600 text-stone-300",
  confirmed: "border-emerald-700 text-emerald-300",
  disputed: "border-amber-700 text-amber-300",
  retired: "border-stone-700 text-stone-500",
  overridden: "border-sky-700 text-sky-300",
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

export function kindSignalsFromFacts(facts: Array<{ field: string; value_kind: string; value_num: number | null; value_text: string | null; value_json: unknown }>): KindSignals {
  return {
    roles: facts.filter((f) => f.field.startsWith("role:")).map((f) => f.field.slice(5)),
    subtitle: facts.find((f) => f.field === "subtitle")?.value_text ?? null,
    civilian: facts.some((f) => f.field === "civilian" && f.value_num === 1),
    notAttackable: facts.some((f) => f.field === "attackable" && f.value_num === 0),
    friendlyToAnyone: facts.some((f) => f.field === "reaction" && ((f.value_json as { reaction?: number })?.reaction ?? 0) >= 5),
  };
}
