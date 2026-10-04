import type { PageServerLoad } from "./$types";
import { listEntities, zoneOverview } from "$lib/server/db/wiki";
import { unitRows } from "$lib/server/wiki-lists";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = (url.searchParams.get("q") ?? "").trim();
  const zones = await zoneOverview(flavor);
  if (!q) return { flavor, q, zones, results: null };
  const [units, areas] = await Promise.all([unitRows(flavor, q, 100), listEntities(flavor, "area", 50, q)]);
  const lower = q.toLowerCase();
  return {
    flavor,
    q,
    zones,
    results: {
      npcs: units.filter((u) => u.kind === "NPC"),
      creatures: units.filter((u) => u.kind === "Creature"),
      zones: zones.filter((z) => z.name.toLowerCase().includes(lower)),
      areas,
    },
  };
};
