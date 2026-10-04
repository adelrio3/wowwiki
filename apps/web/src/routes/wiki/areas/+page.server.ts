import type { PageServerLoad } from "./$types";
import { listEntities, zoneOverview } from "$lib/server/db/wiki";
import { serviceClient } from "$lib/server/supabase";
import { MOCK } from "$lib/server/db/mock";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const [areas, zones] = await Promise.all([listEntities(flavor, "area", 500, q), zoneOverview(flavor)]);
  const zoneName = new Map(zones.map((z) => [z.entity_id, z.name]));
  let areaMap = new Map<number, number>();
  if (MOCK) areaMap = new Map(areas.map((a) => [a.entity_id, 1412]));
  else if (areas.length) {
    const { data } = await serviceClient().from("facts").select("entity_id, value_num").eq("flavor", flavor).eq("entity_type", "area").eq("field", "map").in("entity_id", areas.map((a) => a.entity_id));
    for (const r of data ?? []) if (r.value_num !== null) areaMap.set(r.entity_id, r.value_num);
  }
  const rows = areas.map((a) => ({ ...a, map_id: areaMap.get(a.entity_id) ?? null, zone: zoneName.get(areaMap.get(a.entity_id) ?? -1) ?? null })).sort((a, b) => (a.zone ?? "").localeCompare(b.zone ?? "") || a.name.localeCompare(b.name));
  return { flavor, q, rows };
};
