import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { allOf, buildsFor, entityFacts, entityPositions, mapNames, pickNum, pickText } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "unknown game version");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404);
  const facts = await entityFacts(flavor, "creature", id);
  if (!facts.length) throw error(404, "no one has observed this creature yet");
  const positions = await entityPositions(flavor, "creature", id);
  const maps = await mapNames(flavor, positions.map((p) => p.map_id).filter((m): m is number => m !== null));
  const builds = await buildsFor(flavor);
  const name = pickText(facts, "name");
  const health = allOf(facts, "health").map((f) => f.value_json as { level: number; max: number }).sort((a, b) => a.level - b.level);
  const roles = facts.filter((f) => f.field.startsWith("role:")).map((f) => f.field.slice(5));
  const reactions = allOf(facts, "reaction").map((f) => (f.value_json as { reaction: number }).reaction);
  return {
    flavor,
    id,
    name: name?.value_text ?? `Creature #${id}`,
    nameStatus: name?.status ?? "unconfirmed",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    firstBuild: Math.min(...facts.map((f) => f.first_build)),
    lastBuild: Math.max(...facts.map((f) => f.last_build)),
    levelMin: pickNum(facts, "level_min")?.value_num ?? null,
    levelMax: pickNum(facts, "level_max")?.value_num ?? null,
    classification: pickText(facts, "classification")?.value_text ?? null,
    creatureType: pickText(facts, "creature_type")?.value_text ?? null,
    creatureFamily: pickText(facts, "creature_family")?.value_text ?? null,
    subtitle: pickText(facts, "subtitle")?.value_text ?? null,
    tooltipFaction: pickText(facts, "tooltip_faction")?.value_text ?? null,
    factionGroup: pickText(facts, "faction_group")?.value_text ?? null,
    reactions,
    health,
    roles,
    positions: positions.map((p) => ({ ...p, mapName: p.map_id !== null ? (maps[p.map_id] ?? `Map ${p.map_id}`) : "unknown" })),
    builds,
    facts,
  };
};
