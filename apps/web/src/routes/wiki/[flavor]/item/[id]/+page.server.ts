import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { buildsFor, creatureSummaries, entityFacts, iconUrls, mapNames, objectNames, pickNum, pickText, questSummaries, relationsTo, unitPlaces } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "Unknown game version.");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404, "Not an item.");
  const facts = await entityFacts(flavor, "item", id);
  if (!facts.length) throw error(404, "No one has seen this item yet.");
  const [edges, builds] = await Promise.all([relationsTo(flavor, "item", [id]), buildsFor(flavor)]);
  const name = pickText(facts, "name");
  const icon = pickNum(facts, "icon")?.value_num ?? null;
  const tooltip = (facts.find((f) => f.field === "tooltip")?.value_json as string[] | undefined) ?? [];
  const creatureIds = [...new Set(edges.filter((e) => e.from_type === "creature").map((e) => e.from_id))];
  const objectIds = [...new Set(edges.filter((e) => e.from_type === "gameobject").map((e) => e.from_id))];
  const mapIds = [...new Set(edges.filter((e) => e.from_type === "map").map((e) => e.from_id))];
  const [units, places, objects, maps, icons] = await Promise.all([creatureSummaries(flavor, creatureIds), unitPlaces(flavor, creatureIds), objectNames(flavor, objectIds), mapNames(flavor, mapIds), iconUrls(flavor, [icon])]);
  const where = (cid: number) => places.get(cid)?.[0] ?? null;
  const drops = edges
    .filter((e) => e.rel === "drops" && e.from_type !== "map")
    .map((e) => {
      const u = e.from_type === "creature" ? units.get(e.from_id) : undefined;
      const a = (e.attrs ?? {}) as { min?: number; max?: number; quest?: boolean };
      return { type: e.from_type, id: e.from_id, name: u?.name ?? (e.from_type === "gameobject" ? (objects[e.from_id] ?? `Object #${e.from_id}`) : `#${e.from_id}`), kind: u?.kind ?? null, level_min: u?.level_min ?? null, level_max: u?.level_max ?? null, place: e.from_type === "creature" ? where(e.from_id) : null, seen: e.numerator, windows: e.denominator, min: a.min ?? null, max: a.max ?? null, quest: a.quest ?? false, status: e.status };
    })
    .sort((a, b) => (b.windows ? b.seen / b.windows : 0) - (a.windows ? a.seen / a.windows : 0) || b.seen - a.seen);
  const fished = edges.filter((e) => e.rel === "drops" && e.from_type === "map").map((e) => ({ mapId: e.from_id, name: maps[e.from_id] ?? `Map ${e.from_id}`, seen: e.numerator, windows: e.denominator }));
  const sold = edges
    .filter((e) => e.rel === "sells")
    .map((e) => {
      const u = units.get(e.from_id);
      const a = (e.attrs ?? {}) as { price?: number | null; stack?: number | null; limited?: number | null; ec?: Array<{ i?: number; name?: string; n?: number }> | null };
      return { id: e.from_id, name: u?.name ?? `#${e.from_id}`, place: where(e.from_id), price: a.price ?? null, stack: a.stack ?? null, limited: a.limited ?? null, ec: a.ec ?? null, status: e.status };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const questIds = [...new Set(edges.filter((e) => e.from_type === "quest").map((e) => e.from_id))];
  const quests = await questSummaries(flavor, questIds);
  const questEdges = (rel: string) => edges.filter((e) => e.rel === rel && e.from_type === "quest").map((e) => { const q = quests.get(e.from_id)!; const a = (e.attrs ?? {}) as { n?: number; choice?: boolean }; return { id: e.from_id, name: q.name, level: q.level, n: a.n ?? 1, choice: a.choice ?? false }; }).sort((a, b) => (a.level ?? 999) - (b.level ?? 999));
  const rewardedBy = questEdges("rewards"), neededBy = questEdges("requires");
  const firstBuild = Math.min(...facts.map((f) => f.first_build));
  const lastBuild = Math.max(...facts.map((f) => f.last_build));
  return {
    flavor,
    id,
    name: name?.value_text ?? `Item #${id}`,
    nameStatus: name?.status ?? "unconfirmed",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    observations: facts.reduce((n, f) => n + f.observation_count, 0),
    quality: pickNum(facts, "quality")?.value_num ?? null,
    itemLevel: pickNum(facts, "item_level")?.value_num ?? null,
    requiredLevel: pickNum(facts, "required_level")?.value_num ?? null,
    itemClass: pickText(facts, "class")?.value_text ?? null,
    subclass: pickText(facts, "subclass")?.value_text ?? null,
    equipLoc: pickText(facts, "equip_loc")?.value_text ?? null,
    bindType: pickNum(facts, "bind_type")?.value_num ?? null,
    maxStack: pickNum(facts, "max_stack")?.value_num ?? null,
    sellPrice: pickNum(facts, "sell_price")?.value_num ?? null,
    reagent: pickNum(facts, "reagent")?.value_num === 1,
    iconUrl: icon !== null ? (icons.get(icon) ?? null) : null,
    tooltip,
    drops,
    fished,
    sold,
    rewardedBy,
    neededBy,
    patch: builds.find((b) => b.build === lastBuild)?.patch ?? String(lastBuild),
    expansions: [...new Set(builds.filter((b) => b.build >= firstBuild && b.build <= lastBuild).map((b) => b.expansion))],
    facts,
  };
};
