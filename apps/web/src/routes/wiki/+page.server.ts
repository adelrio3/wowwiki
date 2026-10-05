import type { PageServerLoad } from "./$types";
import { artworkFor, listEntities, zoneOverview, type Artwork } from "$lib/server/db/wiki";
import { itemRows, questRows, unitRows } from "$lib/server/wiki-lists";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = (url.searchParams.get("q") ?? "").trim();
  const zones = await zoneOverview(flavor);
  if (!q) {
    // Drill-down (D-0047): the world map with its continents, or one continent with its zones.
    const continentId = Number(url.searchParams.get("continent") ?? 0);
    const world = zones.find((z) => z.mapType === 1) ?? null;
    const continents = zones.filter((z) => z.mapType === 2 && z.parent !== null && z.parent === world?.entity_id).sort((a, b) => a.name.localeCompare(b.name));
    const continent = continents.find((c) => c.entity_id === continentId) ?? null;
    const focus = continent ?? world;
    const art = focus ? await artworkFor(flavor, "map", focus.entity_id) : null;
    return { flavor, q, zones, world, continents, continent, art, results: null };
  }
  const [units, areas, items, quests] = await Promise.all([unitRows(flavor, q, 100), listEntities(flavor, "area", 50, q), itemRows(flavor, q, 100), questRows(flavor, q, 100)]);
  const lower = q.toLowerCase();
  return {
    flavor,
    q,
    zones,
    world: null,
    continents: [] as Awaited<ReturnType<typeof zoneOverview>>,
    continent: null,
    art: null as Artwork | null,
    results: {
      npcs: units.filter((u) => u.kind === "NPC"),
      creatures: units.filter((u) => u.kind === "Creature"),
      zones: zones.filter((z) => z.name.toLowerCase().includes(lower)),
      areas,
      items,
      quests,
    },
  };
};
