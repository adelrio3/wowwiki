import type { PageServerLoad } from "./$types";
import { recentEntities, wikiCounts } from "$lib/server/db/wiki";

export const load: PageServerLoad = async () => {
  const [counts, creatures, zones] = await Promise.all([wikiCounts(), recentEntities("era", "creature", 8), recentEntities("era", "map", 6)]);
  return { counts, creatures, zones };
};
