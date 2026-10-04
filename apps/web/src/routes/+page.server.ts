import type { PageServerLoad } from "./$types";
import { creatureSummaries, recentEntities, wikiCounts } from "$lib/server/db/wiki";

export const load: PageServerLoad = async () => {
  const [counts, recent, zones] = await Promise.all([wikiCounts(), recentEntities("era", "creature", 8), recentEntities("era", "map", 6)]);
  const summaries = await creatureSummaries("era", recent.map((c) => c.entity_id));
  const units = recent.map((c) => ({ ...c, kind: summaries.get(c.entity_id)?.kind ?? "Creature" }));
  return { counts, units, zones };
};
