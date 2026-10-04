import type { PageServerLoad } from "./$types";
import { listEntities, mapNames } from "$lib/server/db/wiki";
import { serviceClient } from "$lib/server/supabase";
import { MOCK } from "$lib/server/db/mock";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const nodes = await listEntities(flavor, "taxi_node", 300, q);
  const pos = new Map<number, { map_id: number; x: number | null; y: number | null }>();
  if (MOCK) pos.set(22, { map_id: 1412, x: 0.39, y: 0.27 });
  else if (nodes.length) {
    const { data } = await serviceClient().from("positions").select("entity_id, map_id, cluster_x, cluster_y").eq("flavor", flavor).eq("entity_type", "taxi_node").in("entity_id", nodes.map((n) => n.entity_id));
    for (const r of data ?? []) if (r.map_id !== null && !pos.has(r.entity_id)) pos.set(r.entity_id, { map_id: r.map_id, x: r.cluster_x, y: r.cluster_y });
  }
  const names = await mapNames(flavor, [...new Set([...pos.values()].map((p) => p.map_id))]);
  const rows = nodes.map((n) => { const p = pos.get(n.entity_id); return { ...n, map_id: p?.map_id ?? null, zone: p ? names[p.map_id] ?? null : null, x: p?.x ?? null, y: p?.y ?? null }; }).sort((a, b) => a.name.localeCompare(b.name));
  return { flavor, q, rows };
};
