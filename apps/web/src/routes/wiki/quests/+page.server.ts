import type { PageServerLoad } from "./$types";
import { questRows } from "$lib/server/wiki-lists";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const zone = url.searchParams.get("zone") ?? "";
  const sort = url.searchParams.get("sort") ?? "level";
  const all = await questRows(flavor, q);
  const zones = [...new Set(all.map((r) => r.zone).filter((z): z is string => !!z))].sort();
  const filtered = zone ? all.filter((r) => r.zone === zone) : all;
  const rows = sort === "name" ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : sort === "zone" ? [...filtered].sort((a, b) => (a.zone ?? "~").localeCompare(b.zone ?? "~") || (a.level ?? 999) - (b.level ?? 999)) : filtered;
  return { flavor, q, zone, sort, zones, rows };
};
