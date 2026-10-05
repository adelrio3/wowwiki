import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { allOf, artworkFor, buildsFor, entityFacts, entityPositions, iconUrls, itemSummaries, mapNames, pickNum, pickText, relationsFrom } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";
import { kindSignalsFromFacts, unitKind } from "$lib/wiki-format";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "Unknown game version.");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404, "Not a creature.");
  const facts = await entityFacts(flavor, "creature", id);
  if (!facts.length) throw error(404, "No one has observed this creature yet.");
  const [positions, edges] = await Promise.all([entityPositions(flavor, "creature", id), relationsFrom(flavor, "creature", id)]);
  const itemIds = [...new Set(edges.filter((e) => e.to_type === "item").map((e) => e.to_id))];
  const items = await itemSummaries(flavor, itemIds);
  const icons = await iconUrls(flavor, [...items.values()].map((i) => i.icon));
  const itemOf = (iid: number) => { const i = items.get(iid)!; return { id: iid, name: i.name, quality: i.quality, iconUrl: i.icon !== null ? (icons.get(i.icon) ?? null) : null, itemClass: i.class, subclass: i.subclass }; };
  const drops = edges
    .filter((e) => e.rel === "drops" && e.to_type === "item")
    .map((e) => { const a = (e.attrs ?? {}) as { min?: number; max?: number; quest?: boolean }; return { ...itemOf(e.to_id), seen: e.numerator, windows: e.denominator, min: a.min ?? null, max: a.max ?? null, quest: a.quest ?? false, status: e.status }; })
    .sort((a, b) => (b.windows ? b.seen / b.windows : 0) - (a.windows ? a.seen / a.windows : 0) || b.seen - a.seen);
  const sells = edges
    .filter((e) => e.rel === "sells" && e.to_type === "item")
    .map((e) => { const a = (e.attrs ?? {}) as { price?: number | null; stack?: number | null; limited?: number | null; ec?: Array<{ i?: number; name?: string; n?: number }> | null }; return { ...itemOf(e.to_id), price: a.price ?? null, stack: a.stack ?? null, limited: a.limited ?? null, ec: a.ec ?? null, status: e.status }; })
    .sort((a, b) => (a.itemClass ?? "").localeCompare(b.itemClass ?? "") || a.name.localeCompare(b.name));
  const lootWindows = Math.max(0, ...drops.map((d) => d.windows));
  const mapIds = [...new Set(positions.map((p) => p.map_id).filter((m): m is number => m !== null))];
  const maps = await mapNames(flavor, mapIds);
  const builds = await buildsFor(flavor);
  const name = pickText(facts, "name");
  const health = allOf(facts, "health").map((f) => f.value_json as { level: number; max: number }).sort((a, b) => a.level - b.level);
  const roles = facts.filter((f) => f.field.startsWith("role:")).map((f) => f.field.slice(5));
  const reactions = [...new Set(allOf(facts, "reaction").map((f) => (f.value_json as { reaction: number }).reaction))];
  const firstBuild = Math.min(...facts.map((f) => f.first_build));
  const lastBuild = Math.max(...facts.map((f) => f.last_build));
  const locations = mapIds
    .map((mapId) => {
      const spots = positions.filter((p) => p.map_id === mapId && p.cluster_x !== null && p.cluster_y !== null).sort((a, b) => b.observation_count - a.observation_count);
      return { mapId, mapName: maps[mapId] ?? `Map ${mapId}`, sightings: spots.reduce((n, p) => n + p.observation_count, 0), spots: spots.slice(0, 6).map((p) => ({ x: p.cluster_x!, y: p.cluster_y!, n: p.observation_count })) };
    })
    .sort((a, b) => b.sightings - a.sightings);
  const kind = unitKind(kindSignalsFromFacts(facts));
  const homeArt = locations[0] ? await artworkFor(flavor, "map", locations[0].mapId) : null;
  const patch = builds.find((b) => b.build === lastBuild)?.patch ?? String(lastBuild);
  return {
    flavor,
    id,
    kind,
    name: name?.value_text ?? `${kind} #${id}`,
    nameStatus: name?.status ?? "unconfirmed",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    observations: facts.reduce((n, f) => n + f.observation_count, 0),
    patch,
    expansions: [...new Set(builds.filter((b) => b.build >= firstBuild && b.build <= lastBuild).map((b) => b.expansion))],
    levelMin: pickNum(facts, "level_min")?.value_num ?? null,
    levelMax: pickNum(facts, "level_max")?.value_num ?? null,
    classification: pickText(facts, "classification")?.value_text ?? null,
    creatureType: pickText(facts, "creature_type")?.value_text ?? null,
    creatureFamily: pickText(facts, "creature_family")?.value_text ?? null,
    subtitle: pickText(facts, "subtitle")?.value_text ?? null,
    tooltipFaction: pickText(facts, "tooltip_faction")?.value_text ?? null,
    factionGroup: pickText(facts, "faction_group")?.value_text ?? null,
    pvp: pickNum(facts, "pvp")?.value_num === 1,
    reactions,
    health,
    roles,
    locations,
    homeArt,
    drops,
    lootWindows,
    sells,
    repairs: pickNum(facts, "repairs")?.value_num === 1,
    facts,
  };
};
