import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { areasOnMap, creatureSummaries, creaturesOnMap, entityFacts, mapNames, pickNum, pickText, taxiNodesOnMap, unitPlaces } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";
import { UI_MAP_TYPES } from "@compendium/game-meta";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "Unknown game version.");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404, "Not a zone.");
  const facts = await entityFacts(flavor, "map", id);
  if (!facts.length) throw error(404, "No one has visited this map yet.");
  const [onMap, areas, taxi] = await Promise.all([creaturesOnMap(flavor, id, 400), areasOnMap(flavor, id), taxiNodesOnMap(flavor, id)]);
  const ids = onMap.map((c) => c.entity_id);
  const [summaries, places] = await Promise.all([creatureSummaries(flavor, ids), unitPlaces(flavor, ids)]);
  const units = ids
    .map((eid) => ({ ...summaries.get(eid)!, places: places.get(eid) ?? [] }))
    .sort((a, b) => (a.level_min ?? 999) - (b.level_min ?? 999) || a.name.localeCompare(b.name));
  const type = pickNum(facts, "map_type")?.value_num ?? null;
  const parent = pickNum(facts, "parent")?.value_num ?? null;
  const parentName = parent !== null ? (await mapNames(flavor, [parent]))[parent] ?? null : null;
  const name = pickText(facts, "name");
  return {
    flavor,
    id,
    name: name?.value_text ?? `Map #${id}`,
    status: name?.status ?? "unconfirmed",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    lastBuild: Math.max(...facts.map((f) => f.last_build)),
    mapType: type !== null ? (UI_MAP_TYPES[type] ?? String(type)) : null,
    parent,
    parentName,
    npcs: units.filter((u) => u.kind === "NPC"),
    creatures: units.filter((u) => u.kind === "Creature"),
    areas,
    taxi,
  };
};
