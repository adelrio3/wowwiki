import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { areasOnMap, creatureSummaries, creaturesOnMap, entityFacts, pickNum, pickText, taxiNodesOnMap } from "$lib/server/db/wiki";
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
  const summaries = await creatureSummaries(flavor, onMap.map((c) => c.entity_id));
  const units = onMap
    .map((c) => ({ ...summaries.get(c.entity_id)!, positions: c.positions }))
    .sort((a, b) => (a.level_min ?? 999) - (b.level_min ?? 999) || a.name.localeCompare(b.name));
  const points = units.flatMap((c) => c.positions.filter((p) => p.cluster_x !== null && p.cluster_y !== null).map((p) => ({ x: p.cluster_x!, y: p.cluster_y!, label: c.name, href: `/wiki/${flavor}/creature/${c.entity_id}`, weight: p.observation_count })));
  const type = pickNum(facts, "map_type")?.value_num ?? null;
  const parentFacts = pickNum(facts, "parent")?.value_num ?? null;
  return {
    flavor,
    id,
    name: pickText(facts, "name")?.value_text ?? `Map #${id}`,
    status: pickText(facts, "name")?.status ?? "unconfirmed",
    mapType: type !== null ? (UI_MAP_TYPES[type] ?? String(type)) : null,
    parent: parentFacts,
    npcs: units.filter((u) => u.kind === "NPC"),
    creatures: units.filter((u) => u.kind === "Creature"),
    areas,
    taxi,
    points,
  };
};
