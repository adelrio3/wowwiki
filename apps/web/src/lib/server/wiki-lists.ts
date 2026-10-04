/** Shared loaders for the category pages and search. */
import { creatureSummaries, listEntities, unitPlaces, type CreatureListed, type UnitPlace } from "./db/wiki";

export interface UnitRow extends CreatureListed { places: UnitPlace[] }

export async function unitRows(flavor: string, q = "", limit = 300): Promise<UnitRow[]> {
  const names = await listEntities(flavor, "creature", limit, q);
  const ids = names.map((n) => n.entity_id);
  const [summaries, places] = await Promise.all([creatureSummaries(flavor, ids), unitPlaces(flavor, ids)]);
  return ids.map((id) => ({ ...summaries.get(id)!, places: places.get(id) ?? [] })).sort((a, b) => a.name.localeCompare(b.name));
}

export function sortUnits(rows: UnitRow[], sort: string): UnitRow[] {
  if (sort === "level") return [...rows].sort((a, b) => (a.level_min ?? 999) - (b.level_min ?? 999) || a.name.localeCompare(b.name));
  if (sort === "type") return [...rows].sort((a, b) => (a.creature_type ?? "").localeCompare(b.creature_type ?? "") || a.name.localeCompare(b.name));
  return rows;
}
