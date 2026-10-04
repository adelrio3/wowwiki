import type { PageServerLoad } from "./$types";
import { creatureSummaries, listEntities, recentEntities, unitPlaces, wikiCounts, zoneOverview } from "$lib/server/db/wiki";

export const load: PageServerLoad = async () => {
  const [counts, recent, zones, seen] = await Promise.all([wikiCounts(), recentEntities("era", "creature", 8), zoneOverview("era"), listEntities("era", "creature", 300)]);
  const ids = [...new Set([...recent, ...seen].map((c) => c.entity_id))];
  const [summaries, places] = await Promise.all([creatureSummaries("era", ids), unitPlaces("era", ids)]);
  const withPlace = (id: number) => ({ ...summaries.get(id)!, place: places.get(id)?.[0] ?? null });
  const units = recent.map((c) => withPlace(c.entity_id));
  // Rares, elites and bosses: the finds a player would brag about.
  const notable = ids.map(withPlace).filter((u) => u.classification && u.classification !== "normal" && u.classification !== "trivial" && u.classification !== "minus").sort((a, b) => (b.level_min ?? 0) - (a.level_min ?? 0)).slice(0, 6);
  return { counts, units, notable, zones: zones.sort((a, b) => b.units - a.units).slice(0, 6) };
};
