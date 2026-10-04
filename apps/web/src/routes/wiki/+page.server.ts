import type { PageServerLoad } from "./$types";
import { creatureSummaries, listEntities } from "$lib/server/db/wiki";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const [creatureNames, maps, areas, taxi] = await Promise.all([
    listEntities(flavor, "creature", 150, q),
    listEntities(flavor, "map", 100, q),
    listEntities(flavor, "area", 150, q),
    listEntities(flavor, "taxi_node", 100, q),
  ]);
  const summaries = await creatureSummaries(flavor, creatureNames.map((c) => c.entity_id));
  const creatures = creatureNames.map((c) => summaries.get(c.entity_id)!).sort((a, b) => a.name.localeCompare(b.name));
  return { flavor, q, creatures, maps, areas: areas.sort((a, b) => a.name.localeCompare(b.name)), taxi: taxi.sort((a, b) => a.name.localeCompare(b.name)) };
};
