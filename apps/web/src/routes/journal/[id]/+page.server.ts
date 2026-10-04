import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { characterDetail } from "$lib/server/db/journal";
import { mapNames } from "$lib/server/db/wiki";

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/journal");
  const detail = await characterDetail(locals.user.id, params.id);
  if (!detail) throw error(404, "no such character");
  const mapIds = [...new Set([...detail.events.map((e) => e.map_id), ...detail.zonesVisited.map((z) => z.mapId), ...detail.flightPaths.map((f) => f.mapId)].filter((m): m is number => m !== null))];
  const maps = await mapNames(detail.character.flavor, mapIds);
  return { ...detail, maps };
};
