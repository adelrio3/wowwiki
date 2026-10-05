import type { PageServerLoad } from "./$types";
import { itemRows, sortItems } from "$lib/server/wiki-lists";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const quality = url.searchParams.get("quality") ?? "";
  const sort = url.searchParams.get("sort") ?? "name";
  const all = await itemRows(flavor, q);
  const types = [...new Set(all.map((i) => i.class).filter((t): t is string => !!t))].sort();
  const qualities = [...new Set(all.map((i) => i.quality).filter((q): q is number => q !== null))].sort((a, b) => b - a);
  const rows = sortItems(all.filter((i) => (!type || i.class === type) && (!quality || String(i.quality) === quality)), sort);
  return { flavor, q, type, quality, sort, types, qualities, rows };
};
