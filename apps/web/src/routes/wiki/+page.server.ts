import type { PageServerLoad } from "./$types";
import { artworkFor, listEntities, zoneOverview, type Artwork } from "$lib/server/db/wiki";
import { unitRows } from "$lib/server/wiki-lists";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = (url.searchParams.get("q") ?? "").trim();
  const zones = await zoneOverview(flavor);
  if (!q) {
    // Continent maps (the ones under the world map) with their zones placed on them (D-0046).
    const continents = zones.filter((z) => z.mapType === 2 && z.parent !== null).sort((a, b) => a.name.localeCompare(b.name));
    const continentArt: Record<number, Artwork | null> = Object.fromEntries(await Promise.all(continents.map(async (c) => [c.entity_id, await artworkFor(flavor, "map", c.entity_id)] as const)));
    return { flavor, q, zones, continents, continentArt, results: null };
  }
  const [units, areas] = await Promise.all([unitRows(flavor, q, 100), listEntities(flavor, "area", 50, q)]);
  const lower = q.toLowerCase();
  return {
    flavor,
    q,
    zones,
    continents: [] as Awaited<ReturnType<typeof zoneOverview>>,
    continentArt: {} as Record<number, Artwork | null>,
    results: {
      npcs: units.filter((u) => u.kind === "NPC"),
      creatures: units.filter((u) => u.kind === "Creature"),
      zones: zones.filter((z) => z.name.toLowerCase().includes(lower)),
      areas,
    },
  };
};
