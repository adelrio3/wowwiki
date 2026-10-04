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

/** Presentation label: the data model has one "creature" type; readers see NPC vs Creature. */
export function unitKind(opts: { roles: string[]; reactions: number[]; subtitle?: string | null }): "NPC" | "Creature" {
  if (opts.roles.length || opts.subtitle) return "NPC";
  // 5+ is friendly; a unit friendly to the observer and without hostility signals reads as an NPC
  if (opts.reactions.length && opts.reactions.every((r) => r >= 5)) return "NPC";
  return "Creature";
}
