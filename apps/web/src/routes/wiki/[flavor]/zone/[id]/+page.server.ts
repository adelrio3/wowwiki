import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { areasOnMap, artworkFor, bootstrapMap, creatureSummaries, creaturesOnMap, entityFacts, flightMastersOnMap, mapNames, pickNum, pickText, questsOnMap, unitPlaces } from "$lib/server/db/wiki";
import { questRows } from "$lib/server/wiki-lists";
import { FLAVORS } from "@compendium/schema";
import { UI_MAP_TYPES } from "@compendium/game-meta";
import { lastMapArtError } from "$lib/server/map-art";

export const load: PageServerLoad = async ({ params }) => {
  const flavor = params.flavor;
  if (!(FLAVORS as readonly string[]).includes(flavor)) throw error(404, "Unknown game version.");
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(404, "Not a zone.");
  const [facts, boot] = [await entityFacts(flavor, "map", id), bootstrapMap(flavor, id)];
  if (!facts.length && !boot) throw error(404, "Not on any map we have.");
  const [onMap, areas, flight, art, questIds] = await Promise.all([creaturesOnMap(flavor, id, 400), areasOnMap(flavor, id), flightMastersOnMap(flavor, id), artworkFor(flavor, "map", id), questsOnMap(flavor, id)]);
  const quests = questIds.length ? await questRows(flavor, "", 500, questIds) : [];
  const ids = onMap.map((c) => c.entity_id);
  const [summaries, places] = await Promise.all([creatureSummaries(flavor, ids), unitPlaces(flavor, ids)]);
  const units = ids
    .map((eid) => ({ ...summaries.get(eid)!, places: places.get(eid) ?? [] }))
    .sort((a, b) => (a.level_min ?? 999) - (b.level_min ?? 999) || a.name.localeCompare(b.name));
  const type = pickNum(facts, "map_type")?.value_num ?? boot?.type ?? null;
  const parent = pickNum(facts, "parent")?.value_num ?? boot?.parent ?? null;
  const parentName = parent !== null ? ((await mapNames(flavor, [parent]))[parent] ?? bootstrapMap(flavor, parent)?.name ?? null) : null;
  const name = pickText(facts, "name");
  return {
    flavor,
    id,
    name: name?.value_text ?? boot?.name ?? `Map #${id}`,
    status: name?.status ?? "unrecorded",
    contributors: Math.max(0, ...facts.map((f) => f.contributor_count)),
    recorded: facts.length > 0,
    mapType: type !== null ? (UI_MAP_TYPES[type] ?? String(type)) : null,
    parent,
    parentName,
    art,
    artNote: art ? null : (lastMapArtError.get(`${flavor}:${id}`) ?? null),
    npcs: units.filter((u) => u.kind === "NPC"),
    creatures: units.filter((u) => u.kind === "Creature"),
    areas,
    flight,
    quests,
  };
};
