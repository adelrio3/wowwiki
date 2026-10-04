import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { allOf, buildsFor, entityFacts, entityPositions, mapNames, pickNum, pickText } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";
import { kindSignalsFromFacts, unitKind } from "$lib/wiki-format";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "Unknown game version.");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404, "Not a creature.");
  const facts = await entityFacts(flavor, "creature", id);
  if (!facts.length) throw error(404, "No one has observed this creature yet.");
  const positions = await entityPositions(flavor, "creature", id);
  const mapIds = [...new Set(positions.map((p) => p.map_id).filter((m): m is number => m !== null))];
  const maps = await mapNames(flavor, mapIds);
  const builds = await buildsFor(flavor);
  const name = pickText(facts, "name");
  const health = allOf(facts, "health").map((f) => f.value_json as { level: number; max: number }).sort((a, b) => a.level - b.level);
  const roles = facts.filter((f) => f.field.startsWith("role:")).map((f) => f.field.slice(5));
  const reactions = [...new Set(allOf(facts, "reaction").map((f) => (f.value_json as { reaction: number }).reaction))];
  const firstBuild = Math.min(...facts.map((f) => f.first_build));
  const lastBuild = Math.max(...facts.map((f) => f.last_build));
  const byMap = mapIds.map((mapId) => ({
    mapId,
    mapName: maps[mapId] ?? `Map ${mapId}`,
    points: positions.filter((p) => p.map_id === mapId && p.cluster_x !== null && p.cluster_y !== null).map((p) => ({ x: p.cluster_x!, y: p.cluster_y!, label: `${p.observation_count} sighting${p.observation_count === 1 ? "" : "s"}`, weight: p.observation_count })),
  }));
  const kind = unitKind(kindSignalsFromFacts(facts));
  return {
    flavor,
    id,
    kind,
    name: name?.value_text ?? `${kind} #${id}`,
    nameStatus: name?.status ?? "unconfirmed",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    observations: facts.reduce((n, f) => n + f.observation_count, 0),
    firstBuild,
    lastBuild,
    expansions: [...new Set(builds.filter((b) => b.build >= firstBuild && b.build <= lastBuild).map((b) => b.expansion))],
    levelMin: pickNum(facts, "level_min")?.value_num ?? null,
    levelMax: pickNum(facts, "level_max")?.value_num ?? null,
    classification: pickText(facts, "classification")?.value_text ?? null,
    creatureType: pickText(facts, "creature_type")?.value_text ?? null,
    creatureFamily: pickText(facts, "creature_family")?.value_text ?? null,
    subtitle: pickText(facts, "subtitle")?.value_text ?? null,
    tooltipFaction: pickText(facts, "tooltip_faction")?.value_text ?? null,
    factionGroup: pickText(facts, "faction_group")?.value_text ?? null,
    pvp: pickNum(facts, "pvp")?.value_num === 1,
    reactions,
    health,
    roles,
    byMap,
    facts,
  };
};
