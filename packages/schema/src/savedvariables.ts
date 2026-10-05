/**
 * SavedVariables schema, version 1.
 *
 * This is the contract between the add-on (writer), the Lua parser, the sync
 * core (reader, summary), and the ingest function (authoritative reader).
 * The add-on writes plain Lua tables; the parser turns them into JSON by the
 * rules in packages/lua-parser; this file says what that JSON must look like.
 *
 * Conventions the add-on follows so the parsed JSON is unambiguous:
 * - Every ID-keyed map uses STRING keys (tostring(id)), never numeric keys, so
 *   the parser never mistakes a sparse ID map for an array.
 * - Arrays are positional Lua tables (events, positions).
 * - Timestamps are server time (GetServerTime), seconds.
 * - Map positions are fractions 0..1 of the uiMap; world positions are the
 *   raw UnitPosition values (y, x, z, instance).
 *
 * Bump SCHEMA_VERSION on any incompatible change and keep the old version's
 * parser alive (docs/04). Fixtures for every version live under
 * packages/lua-parser/fixtures.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const FLAVORS = ["era", "anniversary", "mists", "retail", "forever"] as const;
export type Flavor = (typeof FLAVORS)[number];
export const FlavorSchema = z.enum(FLAVORS);

/** Lua empty table `{}` parses as `{}`; accept it where an array is expected. */
const luaArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (v) => (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0 ? [] : v),
    z.array(item),
  );

/** Lua empty table `{}` parses as `{}`; accept it where a record is expected. */
const luaRecord = <T extends z.ZodTypeAny>(item: T) => z.record(z.string(), item);

export const PositionSchema = z.object({
  /** uiMapID from C_Map.GetBestMapForUnit("player") */
  m: z.number().int().optional(),
  /** map-relative fraction 0..1 */
  x: z.number().optional(),
  y: z.number().optional(),
  /** world position from UnitPosition: instance id and world x/y */
  i: z.number().int().optional(),
  wx: z.number().optional(),
  wy: z.number().optional(),
  /** server time */
  t: z.number().int(),
  /** how the position was obtained: interact (close range), target, mouseover, nameplate */
  k: z.enum(["interact", "target", "mouseover", "nameplate", "player"]).optional(),
});
export type Position = z.infer<typeof PositionSchema>;

export const CreatureRecordSchema = z.object({
  id: z.number().int(),
  /** GUID type: Creature or Vehicle (player pets are never recorded, D-0038) */
  gt: z.enum(["Creature", "Vehicle", "Pet"]).default("Creature"),
  name: z.string().optional(),
  /** level range seen this session; -1 means boss (skull) */
  lmin: z.number().int().optional(),
  lmax: z.number().int().optional(),
  /** UnitClassification: normal, elite, rare, rareelite, worldboss, trivial, minus */
  cls: z.string().optional(),
  /** UnitCreatureType (localized) */
  ct: z.string().optional(),
  /** UnitCreatureFamily (localized) */
  cf: z.string().optional(),
  /** UnitReaction relative to the player (1..8); the player's faction is in ctx */
  rx: z.number().int().optional(),
  /** UnitFactionGroup: Alliance, Horde, or nil */
  fg: z.string().optional(),
  pvp: z.boolean().optional(),
  civ: z.boolean().optional(),
  /** UnitCanAttack("player", unit) */
  atk: z.boolean().optional(),
  sex: z.number().int().optional(),
  /** power type id */
  pt: z.number().int().optional(),
  /** max health by level, recorded only when health == max: { "4": 86 } */
  hp: luaRecord(z.number().int()).optional(),
  /** max power by level */
  pw: luaRecord(z.number().int()).optional(),
  /** tooltip subtitle line, e.g. "Warrior Trainer"; absent when line 2 is "Level N" */
  sub: z.string().optional(),
  /** tooltip faction line, e.g. "Thunder Bluff" */
  tf: z.string().optional(),
  /** roles observed through interactions: gossip, quest, vendor, trainer, taxi, bank, ... */
  roles: luaRecord(z.boolean()).optional(),
  /** sightings this session */
  n: z.number().int().default(1),
  /** distinct spawn UIDs seen */
  sp: z.number().int().optional(),
  ft: z.number().int(),
  lt: z.number().int(),
  pos: luaArray(PositionSchema).optional(),
});
export type CreatureRecord = z.infer<typeof CreatureRecordSchema>;

/** Base map art layer: tile grid and the client files that fill it (D-0041). */
export const MapArtSchema = z.object({
  w: z.number().int(),
  h: z.number().int(),
  tw: z.number().int(),
  th: z.number().int(),
  /** FileDataIDs, row-major */
  t: luaArray(z.number().int()),
  /** C_Map.GetMapArtID */
  aid: z.number().int().optional(),
});
/** One explored-area picture and where the client draws it, in layer pixels. */
export const MapOverlaySchema = z.object({
  w: z.number().int(),
  h: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  /** FileDataIDs, row-major over 256 px tiles */
  t: luaArray(z.number().int()),
});
export const MapRecordSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  /** Enum.UIMapType */
  type: z.number().int().optional(),
  parent: z.number().int().optional(),
  art: MapArtSchema.optional(),
  ovl: luaArray(MapOverlaySchema).optional(),
  ft: z.number().int(),
});
export type MapArt = z.infer<typeof MapArtSchema>;
export type MapOverlay = z.infer<typeof MapOverlaySchema>;

export const AreaRecordSchema = z.object({
  /** areaID from C_MapExplorationInfo.GetExploredAreaIDsAtPosition */
  id: z.number().int(),
  /** C_Map.GetAreaInfo(id), localized */
  name: z.string().optional(),
  /** uiMapID the area was observed on */
  m: z.number().int().optional(),
  /** GetZoneText / GetSubZoneText at the time */
  zone: z.string().optional(),
  sub: z.string().optional(),
  ft: z.number().int(),
  lt: z.number().int(),
  pos: luaArray(PositionSchema).optional(),
});

/** Subzone text seen where no area ID could be resolved (keyed "Zone/Sub"). */
export const ZoneTextRecordSchema = z.object({
  zone: z.string(),
  sub: z.string().optional(),
  m: z.number().int().optional(),
  indoors: z.boolean().optional(),
  ft: z.number().int(),
  lt: z.number().int(),
  pos: luaArray(PositionSchema).optional(),
});

export const InstanceRecordSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  /** none, party, raid, pvp, arena, scenario */
  type: z.string().optional(),
  diff: z.number().int().optional(),
  diffName: z.string().optional(),
  max: z.number().int().optional(),
  ft: z.number().int(),
});

export const TaxiNodeRecordSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  /** uiMapID the catalog was read for */
  m: z.number().int().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  faction: z.number().int().optional(),
  /** false means the character has discovered it (Journal state) */
  undiscovered: z.boolean().optional(),
  /** this character can fly from or to it (flight map state current/reachable): Journal */
  known: z.boolean().optional(),
  /** npcID of the flight master who opened the map here */
  fm: z.number().int().optional(),
  /** destination nodeIDs reachable from this node, as the flight map showed */
  routes: luaRecord(z.boolean()).optional(),
  ft: z.number().int(),
});

/** One item as the client describes it (GetItemInfo) plus its tooltip lines. */
export const ItemRecordSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  /** quality 0 poor .. 7 heirloom */
  q: z.number().int().optional(),
  /** item level */
  il: z.number().int().optional(),
  /** required level */
  rl: z.number().int().optional(),
  /** class and subclass names, localized */
  cls: z.string().optional(),
  sub: z.string().optional(),
  cid: z.number().int().optional(),
  sid: z.number().int().optional(),
  /** max stack */
  st: z.number().int().optional(),
  /** equip location token, e.g. INVTYPE_WEAPON */
  eq: z.string().optional(),
  /** icon FileDataID */
  ic: z.number().int().optional(),
  /** sell price in copper */
  sp: z.number().int().optional(),
  /** bind type: 0 none, 1 on pickup, 2 on equip, 3 on use, 4 quest */
  bt: z.number().int().optional(),
  xp: z.number().int().optional(),
  set: z.number().int().optional(),
  /** crafting reagent */
  rg: z.boolean().optional(),
  /** tooltip left-column lines, in order, as the client rendered them */
  tip: luaArray(z.string()).optional(),
  ft: z.number().int(),
  lt: z.number().int(),
});
export type ItemRecord = z.infer<typeof ItemRecordSchema>;

/** Loot windows from one source: a creature (c), a game object (o) or fishing on a map (f). */
export const LootRecordSchema = z.object({
  k: z.enum(["c", "o", "f"]),
  id: z.number().int(),
  /** windows opened this session, one per spawn, empty ones included */
  w: z.number().int().default(0),
  /** per itemID: windows that held it, quantity range, quest item flag */
  items: luaRecord(z.object({ n: z.number().int(), min: z.number().int().optional(), max: z.number().int().optional(), q: z.boolean().optional() })).default({}),
  ft: z.number().int(),
  lt: z.number().int(),
});
export type LootRecord = z.infer<typeof LootRecordSchema>;

/** A merchant's wares: per itemID the copper price, stack size, limited stock and extended costs. */
export const VendorRecordSchema = z.object({
  id: z.number().int(),
  items: luaRecord(z.object({
    p: z.number().int().optional(),
    st: z.number().int().optional(),
    /** stock on hand when limited; absent when unlimited */
    lim: z.number().int().optional(),
    ec: luaArray(z.object({ i: z.number().int().optional(), name: z.string().optional(), n: z.number().int().optional() })).optional(),
  })).default({}),
  /** can repair */
  rep: z.boolean().optional(),
  ft: z.number().int(),
  lt: z.number().int(),
});
export type VendorRecord = z.infer<typeof VendorRecordSchema>;

export const WorldSchema = z.object({
  creatures: luaRecord(CreatureRecordSchema).default({}),
  maps: luaRecord(MapRecordSchema).default({}),
  areas: luaRecord(AreaRecordSchema).default({}),
  zoneTexts: luaRecord(ZoneTextRecordSchema).default({}),
  instances: luaRecord(InstanceRecordSchema).default({}),
  taxiNodes: luaRecord(TaxiNodeRecordSchema).default({}),
  items: luaRecord(ItemRecordSchema).default({}),
  loot: luaRecord(LootRecordSchema).default({}),
  vendors: luaRecord(VendorRecordSchema).default({}),
});
export type World = z.infer<typeof WorldSchema>;

export const EVENT_KINDS = [
  "login",
  "logout",
  "level_up",
  "zone_enter",
  "area_discovered",
  "instance_enter",
  "death",
  "xp",
  "loot",
] as const;

export const JournalEventSchema = z.object({
  t: z.number().int(),
  k: z.enum(EVENT_KINDS),
  m: z.number().int().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  i: z.number().int().optional(),
  wx: z.number().optional(),
  wy: z.number().optional(),
  /** kind-specific payload; validated per kind in ingest */
  d: z.record(z.string(), z.unknown()).optional(),
});
export type JournalEvent = z.infer<typeof JournalEventSchema>;

export const SessionContextSchema = z.object({
  flavor: FlavorSchema,
  project: z.number().int(),
  version: z.string(),
  build: z.number().int(),
  interface: z.number().int().optional(),
  locale: z.string(),
  region: z.number().int().optional(),
  regionName: z.string().optional(),
  realm: z.string(),
  realmNormalized: z.string().optional(),
  realmId: z.number().int().optional(),
  connectedRealms: luaArray(z.string()).optional(),
  hardcore: z.boolean().optional(),
  season: z.number().int().optional(),
  addon: z.string(),
  reload: z.boolean().optional(),
  started: z.number().int(),
  ended: z.number().int().optional(),
  levelStart: z.number().int().optional(),
  levelEnd: z.number().int().optional(),
});

export const CharacterStateSchema = z.object({
  level: z.number().int().optional(),
  xp: z.number().int().optional(),
  xpMax: z.number().int().optional(),
  playedTotal: z.number().int().optional(),
  playedLevel: z.number().int().optional(),
  money: z.number().int().optional(),
  /** explored area IDs accumulated this session */
  explored: luaArray(z.number().int()).optional(),
  bind: z.string().optional(),
});

export const SessionSchema = z.object({
  seq: z.number().int(),
  ctx: SessionContextSchema,
  world: WorldSchema.default({}),
  events: luaArray(JournalEventSchema).default([]),
  state: CharacterStateSchema.default({}),
});
export type Session = z.infer<typeof SessionSchema>;

export const CharacterMetaSchema = z.object({
  guid: z.string(),
  name: z.string(),
  realm: z.string(),
  realmNormalized: z.string().optional(),
  realmId: z.number().int().optional(),
  region: z.number().int().optional(),
  class: z.string().optional(),
  classId: z.number().int().optional(),
  race: z.string().optional(),
  raceId: z.number().int().optional(),
  faction: z.string().optional(),
  sex: z.number().int().optional(),
  flavor: FlavorSchema,
});

export const CharacterSchema = z.object({
  meta: CharacterMetaSchema,
  nextSeq: z.number().int(),
  sessions: luaRecord(SessionSchema).default({}),
});

export const SavedVariablesSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  addonVersion: z.string(),
  identity: z.string().min(8),
  link: z
    .object({ accountToken: z.string().optional(), linkedAt: z.number().int().optional() })
    .optional(),
  ack: luaRecord(z.number().int()).default({}),
  characters: luaRecord(CharacterSchema).default({}),
});
export type SavedVariables = z.infer<typeof SavedVariablesSchema>;

/** The global variable name declared in the TOC. */
export const SAVEDVARIABLES_GLOBAL = "WoWCompendiumDB";

/** Parse a whole SavedVariables document ({ WoWCompendiumDB = {...} }). */
export function parseSavedVariablesDocument(doc: unknown): SavedVariables {
  if (!doc || typeof doc !== "object" || !(SAVEDVARIABLES_GLOBAL in doc)) {
    throw new Error(`missing global ${SAVEDVARIABLES_GLOBAL}`);
  }
  return SavedVariablesSchema.parse((doc as Record<string, unknown>)[SAVEDVARIABLES_GLOBAL]);
}

/** Lightweight summary used by the sync UI before upload. */
export interface SavedVariablesSummary {
  schema: number;
  addonVersion: string;
  identity: string;
  linked: boolean;
  characters: Array<{ guid: string; name: string; realm: string; flavor: Flavor; sessions: number; maxSeq: number; acked: number }>;
}

export function summarize(sv: SavedVariables): SavedVariablesSummary {
  return {
    schema: sv.schema,
    addonVersion: sv.addonVersion,
    identity: sv.identity,
    linked: Boolean(sv.link?.accountToken),
    characters: Object.entries(sv.characters).map(([guid, c]) => {
      const seqs = Object.values(c.sessions).map((s) => s.seq);
      return {
        guid,
        name: c.meta.name,
        realm: c.meta.realm,
        flavor: c.meta.flavor,
        sessions: seqs.length,
        maxSeq: seqs.length ? Math.max(...seqs) : c.nextSeq - 1,
        acked: sv.ack[guid] ?? 0,
      };
    }),
  };
}
