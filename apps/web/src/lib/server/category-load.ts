import { sortUnits, unitRows } from "./wiki-lists";

/** Loader shared by the NPCs and Creatures pages. */
export async function loadUnitCategory(url: URL, kind: "NPC" | "Creature") {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const q = url.searchParams.get("q") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const sort = url.searchParams.get("sort") ?? "name";
  const all = (await unitRows(flavor, q)).filter((u) => u.kind === kind);
  const types = [...new Set(all.map((u) => u.creature_type).filter((t): t is string => !!t))].sort();
  const rows = sortUnits(type ? all.filter((u) => u.creature_type === type) : all, sort);
  return { flavor, q, type, sort, types, rows, kind };
}
