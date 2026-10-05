/**
 * Fixture data for rendering every page without a database
 * (COMPENDIUM_MOCK=1). Used by the design checks (scripts/check-pages.mjs)
 * and for local work on layout. Shapes mirror the real query results.
 */
import { env } from "$env/dynamic/private";
import type { FactRow, PositionRow, Listed, CreatureListed } from "./wiki";

export const MOCK = env.COMPENDIUM_MOCK === "1";

const t = "2026-10-04T12:00:00.000Z";
const fact = (field: string, v: Partial<FactRow>): FactRow => ({ field, locale: "enUS", value_kind: "text", value_num: null, value_text: null, value_json: null, first_build: 70003, last_build: 70003, contributor_count: 1, observation_count: 3, status: "confirmed", source: "encounter", ...v });

export const mockCreatureFacts: Record<number, FactRow[]> = {
  2995: [
    fact("name", { value_text: "Tal" }),
    fact("level_min", { value_kind: "num", value_num: 55 }),
    fact("level_max", { value_kind: "num", value_num: 55 }),
    fact("classification", { value_text: "elite" }),
    fact("creature_type", { value_text: "Humanoid" }),
    fact("reaction", { value_kind: "json", value_json: { reaction: 5 } }),
    fact("tooltip_faction", { value_text: "Thunder Bluff" }),
    fact("subtitle", { value_text: "Flight Master" }),
    fact("role:taxi", { value_kind: "bool", value_num: 1 }),
    fact("role:gossip", { value_kind: "bool", value_num: 1 }),
    fact("health", { value_kind: "json", value_json: { level: 55, max: 7842 } }),
  ],
  2955: [
    fact("name", { value_text: "Plainstrider", status: "unconfirmed" }),
    fact("level_min", { value_kind: "num", value_num: 1 }),
    fact("level_max", { value_kind: "num", value_num: 2 }),
    fact("classification", { value_text: "normal" }),
    fact("creature_type", { value_text: "Beast" }),
    fact("creature_family", { value_text: "Tallstrider" }),
    fact("reaction", { value_kind: "json", value_json: { reaction: 4 } }),
    fact("health", { value_kind: "json", value_json: { level: 1, max: 42 } }),
    fact("health", { value_kind: "json", value_json: { level: 2, max: 55 } }),
  ],
};

export const mockPositions: Record<number, PositionRow[]> = {
  3222: [{ map_id: 1412, cluster_x: 0.47, cluster_y: 0.6, observation_count: 2, contributor_count: 1 }],
  2995: [{ map_id: 1456, cluster_x: 0.46, cluster_y: 0.5, observation_count: 4, contributor_count: 1 }],
  2955: [
    { map_id: 1412, cluster_x: 0.52, cluster_y: 0.86, observation_count: 9, contributor_count: 1 },
    { map_id: 1412, cluster_x: 0.49, cluster_y: 0.81, observation_count: 3, contributor_count: 1 },
  ],
};

export const mockMaps: Record<number, string> = { 1412: "Mulgore", 1456: "Thunder Bluff", 1414: "Kalimdor" };

export const mockListed = {
  creature: [
    { entity_id: 2995, name: "Tal", status: "confirmed", contributor_count: 1, last_build: 70003 },
    { entity_id: 2955, name: "Plainstrider", status: "unconfirmed", contributor_count: 1, last_build: 70003 },
    { entity_id: 2958, name: "Prairie Wolf", status: "disputed", contributor_count: 3, last_build: 70003 },
    { entity_id: 3222, name: "Brave Wildrunner", status: "unconfirmed", contributor_count: 1, last_build: 70003 },
  ] as Listed[],
  map: [
    { entity_id: 1412, name: "Mulgore", status: "confirmed", contributor_count: 1, last_build: 70003 },
    { entity_id: 1456, name: "Thunder Bluff", status: "confirmed", contributor_count: 1, last_build: 70003 },
  ] as Listed[],
  area: [
    { entity_id: 222, name: "Bloodhoof Village", status: "confirmed", contributor_count: 1, last_build: 70003 },
    { entity_id: 221, name: "Red Cloud Mesa", status: "unconfirmed", contributor_count: 1, last_build: 70003 },
  ] as Listed[],
  taxi_node: [{ entity_id: 22, name: "Thunder Bluff, Mulgore", status: "confirmed", contributor_count: 1, last_build: 70003 }] as Listed[],
};

export const mockSummaries: CreatureListed[] = [
  { entity_id: 2995, name: "Tal", status: "confirmed", contributor_count: 1, last_build: 70003, level_min: 55, level_max: 55, creature_type: "Humanoid", classification: "elite", kind: "NPC" },
  { entity_id: 2955, name: "Plainstrider", status: "unconfirmed", contributor_count: 1, last_build: 70003, level_min: 1, level_max: 2, creature_type: "Beast", classification: "normal", kind: "Creature" },
  { entity_id: 2958, name: "Prairie Wolf", status: "disputed", contributor_count: 3, last_build: 70003, level_min: 6, level_max: 7, creature_type: "Beast", classification: "normal", kind: "Creature" },
  { entity_id: 3222, name: "Brave Wildrunner", status: "unconfirmed", contributor_count: 1, last_build: 70003, level_min: 14, level_max: 14, creature_type: "Humanoid", classification: "normal", kind: "NPC" },
];

export const mockCharacters = [
  { id: "c1", flavor: "era", name: "Eigan", class: "HUNTER", race: "Tauren", faction: "Horde", level: 7, last_seen_at: t, realms: { name: "Mankrik" } },
  { id: "c2", flavor: "era", name: "Beefybows", class: "WARRIOR", race: "Tauren", faction: "Horde", level: 3, last_seen_at: t, realms: { name: "Mankrik" } },
];

export const mockCharacterDetail = {
  character: { id: "c1", flavor: "era", name: "Eigan", class: "HUNTER", race: "Tauren", faction: "Horde", level: 7, player_guid: "Player-5149-04E14735", created_at: t, last_seen_at: t, realms: { name: "Mankrik" } },
  stats: { played_total: 15610, played_level: 3453, deaths: 1, sessions: 3, level: 7, money: 1267 },
  events: [
    { kind: "logout", at: "2026-10-04T12:40:00.000Z", payload: { level: 7 }, map_id: 1412 },
    { kind: "level_up", at: "2026-10-04T12:31:00.000Z", payload: { level: 7 }, map_id: 1412 },
    { kind: "first_sighting", at: "2026-10-04T12:20:00.000Z", payload: { entity_type: "creature", entity_id: 2958, name: "Prairie Wolf" }, map_id: 1412 },
    { kind: "area_discovered", at: "2026-10-04T12:12:00.000Z", payload: { name: "Brambleblade Ravine", xp: 25 }, map_id: 1412 },
    { kind: "zone_enter", at: "2026-10-04T12:05:00.000Z", payload: { zone: "Mulgore" }, map_id: 1412 },
    { kind: "login", at: "2026-10-04T12:00:00.000Z", payload: { level: 6 }, map_id: 1412 },
    { kind: "death", at: "2026-10-03T22:10:00.000Z", payload: { level: 5 }, map_id: 1412 },
  ],
  sessions: [
    { seq: 3, started_at: "2026-10-04T12:00:00.000Z", ended_at: "2026-10-04T12:40:00.000Z", build: 70003, level_start: 6, level_end: 7 },
    { seq: 2, started_at: "2026-10-03T21:00:00.000Z", ended_at: "2026-10-03T22:30:00.000Z", build: 70003, level_start: 5, level_end: 6 },
  ],
  exploredCount: 4,
  flightPaths: [{ nodeId: 22, name: "Thunder Bluff, Mulgore", mapId: 1412, since: t }, { nodeId: 25, name: "The Crossroads, The Barrens", mapId: 1413, since: t }],
  zonesVisited: [{ mapId: 1412, at: "2026-10-03T21:00:00.000Z" }, { mapId: 1456, at: "2026-10-04T12:30:00.000Z" }],
};

export const mockUploads = [
  { id: "u1", flavor: "era", received_at: t, ingest_status: "ingested", ingest_error: null, observation_count: 212, byte_size: 41022 },
  { id: "u0", flavor: "era", received_at: "2026-10-03T22:35:00.000Z", ingest_status: "failed", ingest_error: "raw file missing", observation_count: null, byte_size: 3900 },
];

/** A stand-in map image (our own drawing, not game art) so layouts can be checked without a database. */
export const mockArtwork: Record<number, { url: string; width: number; height: number; pieces: number }> = {
  1412: { url: "/mock/map.svg", width: 1002, height: 668, pieces: 9 },
  1456: { url: "/mock/map.svg", width: 1002, height: 668, pieces: 1 },
  1414: { url: "/mock/map.svg", width: 1002, height: 668, pieces: 0 },
  1415: { url: "/mock/map.svg", width: 1002, height: 668, pieces: 0 },
  947: { url: "/mock/map.svg", width: 1002, height: 668, pieces: 0 },
};

