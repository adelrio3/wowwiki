import type { PageServerLoad } from "./$types";
import { listEntities } from "$lib/server/db/wiki";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const [creatures, maps, areas] = await Promise.all([
    listEntities(flavor, "creature", 60, q),
    listEntities(flavor, "map", 60, q),
    listEntities(flavor, "area", 60, q),
  ]);
  return { flavor, q, creatures, maps, areas };
};
