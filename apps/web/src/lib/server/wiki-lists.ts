/** Shared loaders for the category pages and search. */
import { creatureSummaries, iconUrls, itemSummaries, listEntities, relationsTo, unitPlaces, type CreatureListed, type ItemListed, type UnitPlace } from "./db/wiki";

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

export interface ItemRow extends ItemListed {
  iconUrl: string | null;
  /** how players get it: counts of sources of each kind */
  drops: number;
  sells: number;
  fished: boolean;
}

export async function itemRows(flavor: string, q = "", limit = 400): Promise<ItemRow[]> {
  const names = await listEntities(flavor, "item", limit, q);
  const ids = names.map((n) => n.entity_id);
  const [summaries, edges] = await Promise.all([itemSummaries(flavor, ids), relationsTo(flavor, "item", ids)]);
  const icons = await iconUrls(flavor, [...summaries.values()].map((i) => i.icon));
  return ids
    .map((id) => {
      const i = summaries.get(id)!;
      const mine = edges.filter((e) => e.to_id === id);
      return { ...i, iconUrl: i.icon !== null ? (icons.get(i.icon) ?? null) : null, drops: mine.filter((e) => e.rel === "drops" && e.from_type !== "map").length, sells: mine.filter((e) => e.rel === "sells").length, fished: mine.some((e) => e.rel === "drops" && e.from_type === "map") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function sortItems(rows: ItemRow[], sort: string): ItemRow[] {
  if (sort === "level") return [...rows].sort((a, b) => (b.item_level ?? -1) - (a.item_level ?? -1) || a.name.localeCompare(b.name));
  if (sort === "quality") return [...rows].sort((a, b) => (b.quality ?? -1) - (a.quality ?? -1) || (b.item_level ?? -1) - (a.item_level ?? -1) || a.name.localeCompare(b.name));
  if (sort === "type") return [...rows].sort((a, b) => (a.class ?? "").localeCompare(b.class ?? "") || (a.subclass ?? "").localeCompare(b.subclass ?? "") || a.name.localeCompare(b.name));
  return rows;
}
