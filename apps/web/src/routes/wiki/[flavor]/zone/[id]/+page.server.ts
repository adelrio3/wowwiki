import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { areasOnMap, creaturesOnMap, entityFacts, pickNum, pickText } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";
import { UI_MAP_TYPES } from "@compendium/game-meta";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "unknown game version");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404);
  const facts = await entityFacts(flavor, "map", id);
  if (!facts.length) throw error(404, "no one has visited this map yet");
  const [creatures, areas] = await Promise.all([creaturesOnMap(flavor, id), areasOnMap(flavor, id)]);
  const type = pickNum(facts, "map_type")?.value_num ?? null;
  return {
    flavor,
    id,
    name: pickText(facts, "name")?.value_text ?? `Map #${id}`,
    mapType: type !== null ? (UI_MAP_TYPES[type] ?? String(type)) : null,
    parent: pickNum(facts, "parent")?.value_num ?? null,
    creatures,
    areas,
  };
};
