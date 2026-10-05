/** Shared loaders for the category pages and search. */
import { creatureSummaries, iconUrls, itemSummaries, listEntities, mapNames, questMaps, questSummaries, relationsTo, unitPlaces, type CreatureListed, type ItemListed, type QuestListed, type UnitPlace } from "./db/wiki";

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

export interface QuestRow extends QuestListed {
  mapId: number | null;
  zone: string | null;
  giver: { id: number; name: string } | null;
  ender: { id: number; name: string } | null;
  rewards: number;
}

/** Quests with where they start and who gives them, for the category page, search and zone pages. */
export async function questRows(flavor: string, q = "", limit = 500, ids?: number[]): Promise<QuestRow[]> {
  const questIds = ids ?? (await listEntities(flavor, "quest", limit, q)).map((n) => n.entity_id);
  if (!questIds.length) return [];
  const [summaries, maps, edges] = await Promise.all([questSummaries(flavor, questIds), questMaps(flavor, questIds), relationsTo(flavor, "quest", questIds)]);
  const npcIds = [...new Set(edges.filter((e) => e.from_type === "creature").map((e) => e.from_id))];
  const [npcs, zones] = await Promise.all([creatureSummaries(flavor, npcIds), mapNames(flavor, [...new Set(maps.values())])]);
  const who = (qid: number, rel: string) => { const e = edges.filter((x) => x.to_id === qid && x.rel === rel).sort((a, b) => b.numerator - a.numerator)[0]; return e ? { id: e.from_id, name: npcs.get(e.from_id)?.name ?? `#${e.from_id}` } : null; };
  return questIds
    .map((id) => { const s = summaries.get(id)!; const mapId = maps.get(id) ?? null; return { ...s, mapId, zone: mapId !== null ? (zones[mapId] ?? null) : null, giver: who(id, "starts"), ender: who(id, "ends"), rewards: 0 }; })
    .sort((a, b) => (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name));
}
