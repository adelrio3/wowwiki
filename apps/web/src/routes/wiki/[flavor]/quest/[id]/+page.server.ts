import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { allOf, artworkFor, buildsFor, creatureSummaries, entityFacts, entityPositions, iconUrls, itemSummaries, mapNames, pickNum, pickText, relationsFrom, relationsTo, unitPlaces } from "$lib/server/db/wiki";
import { FLAVORS } from "@compendium/schema";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "Unknown game version.");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404, "Not a quest.");
  const facts = await entityFacts(flavor, "quest", id);
  if (!facts.length) throw error(404, "No one has been offered this quest yet.");
  const [into, outOf, positions, builds] = await Promise.all([relationsTo(flavor, "quest", [id]), relationsFrom(flavor, "quest", id), entityPositions(flavor, "quest", id), buildsFor(flavor)]);
  const npcIds = [...new Set(into.filter((e) => e.from_type === "creature").map((e) => e.from_id))];
  const itemIds = [...new Set(outOf.filter((e) => e.to_type === "item").map((e) => e.to_id))];
  const [npcs, places, items] = await Promise.all([creatureSummaries(flavor, npcIds), unitPlaces(flavor, npcIds), itemSummaries(flavor, itemIds)]);
  const icons = await iconUrls(flavor, [...items.values()].map((i) => i.icon));
  const person = (rel: string) => into.filter((e) => e.rel === rel && e.from_type === "creature").sort((a, b) => b.numerator - a.numerator).map((e) => { const u = npcs.get(e.from_id); return { id: e.from_id, name: u?.name ?? `#${e.from_id}`, place: places.get(e.from_id)?.[0] ?? null, status: e.status }; });
  const itemOf = (iid: number, attrs: Record<string, unknown> | null) => { const i = items.get(iid)!; const a = (attrs ?? {}) as { n?: number; choice?: boolean }; return { id: iid, name: i.name, quality: i.quality, iconUrl: i.icon !== null ? (icons.get(i.icon) ?? null) : null, itemClass: i.class, subclass: i.subclass, n: a.n ?? 1, choice: a.choice ?? false }; };
  const rewards = outOf.filter((e) => e.rel === "rewards").map((e) => itemOf(e.to_id, e.attrs)).sort((a, b) => Number(a.choice) - Number(b.choice) || a.name.localeCompare(b.name));
  const requires = outOf.filter((e) => e.rel === "requires").map((e) => itemOf(e.to_id, e.attrs));
  const mapIds = [...new Set(positions.map((p) => p.map_id).filter((m): m is number => m !== null))];
  const maps = await mapNames(flavor, mapIds);
  const startMap = positions.sort((a, b) => b.observation_count - a.observation_count)[0]?.map_id ?? null;
  const name = pickText(facts, "name");
  const firstBuild = Math.min(...facts.map((f) => f.first_build)), lastBuild = Math.max(...facts.map((f) => f.last_build));
  const giverSpot = positions.find((p) => p.map_id === startMap && p.cluster_x !== null);
  return {
    flavor,
    id,
    name: name?.value_text ?? `Quest #${id}`,
    nameStatus: name?.status ?? "unconfirmed",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    observations: facts.reduce((n, f) => n + f.observation_count, 0),
    level: pickNum(facts, "level")?.value_num ?? null,
    suggestedGroup: pickNum(facts, "suggested_group")?.value_num ?? null,
    header: pickText(facts, "log_header")?.value_text ?? null,
    frequency: pickNum(facts, "frequency")?.value_num ?? null,
    description: pickText(facts, "description")?.value_text ?? null,
    objectivesText: pickText(facts, "objectives_text")?.value_text ?? null,
    objectives: allOf(facts, "objective").map((f) => f.value_json as { text: string; type: string | null; n: number | null }),
    progressText: pickText(facts, "progress_text")?.value_text ?? null,
    completionText: pickText(facts, "completion_text")?.value_text ?? null,
    xp: pickNum(facts, "reward_xp")?.value_num ?? null,
    money: pickNum(facts, "reward_money")?.value_num ?? null,
    requiredMoney: pickNum(facts, "required_money")?.value_num ?? null,
    itemStarted: pickNum(facts, "item_started")?.value_num === 1,
    givers: person("starts"),
    enders: person("ends"),
    rewards,
    requires,
    startMap,
    startMapName: startMap !== null ? (maps[startMap] ?? `Map ${startMap}`) : null,
    giverSpot: giverSpot ? { x: giverSpot.cluster_x!, y: giverSpot.cluster_y! } : null,
    art: startMap !== null ? await artworkFor(flavor, "map", startMap) : null,
    patch: builds.find((b) => b.build === lastBuild)?.patch ?? String(lastBuild),
    expansions: [...new Set(builds.filter((b) => b.build >= firstBuild && b.build <= lastBuild).map((b) => b.expansion))],
    facts,
  };
};
