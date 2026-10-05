import { describe, expect, it } from "vitest";
import { SessionSchema } from "@compendium/schema";
import { observationsFor } from "./index";
import { computeFacts, computePositions, computeRelations, type Obs } from "./aggregate";

const session = SessionSchema.parse({
  seq: 1,
  ctx: { flavor: "era", project: 2, version: "1.15.9", build: 70003, locale: "enUS", region: 1, realm: "Mankrik", addon: "0.1.0", started: 1790998608, ended: 1790999000 },
  world: {
    creatures: {
      "1555": { id: 1555, gt: "Pet", name: "Happyending", lmin: 7, lmax: 7, ct: "Beast", sub: "Pongping's Pet", n: 1, sp: 1, ft: 1790998620, lt: 1790998620 },
      "3063": { id: 3063, name: "Krang Stonehoof", lmin: 14, lmax: 14, cls: "normal", ct: "Humanoid", rx: 5, sub: "Warrior Trainer", tf: "Thunder Bluff", hp: { "14": 500 }, roles: { trainer: true }, n: 2, sp: 1, ft: 1790998610, lt: 1790998700, pos: [{ t: 1790998610, m: 1412, x: 0.5, y: 0.8, i: 1, wx: -351.8, wy: -2357, k: "interact" }] },
    },
    maps: { "1412": { id: 1412, name: "Mulgore", type: 3, parent: 1414, ft: 1790998608, art: { w: 1002, h: 668, tw: 256, th: 256, t: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], aid: 6412 }, ovl: [{ w: 256, h: 256, x: 300, y: 200, t: [272173] }] } },
    areas: { "222": { id: 222, name: "Bloodhoof Village", m: 1412, zone: "Mulgore", sub: "Bloodhoof Village", ft: 1790998608, lt: 1790998700 } },
    taxiNodes: { "22": { id: 22, name: "Thunder Bluff, Mulgore", m: 1412, x: 0.39, y: 0.27, faction: 1, undiscovered: false, known: true, fm: 2995, routes: { "25": true }, ft: 1790998608 } },
    items: { "3184": { id: 3184, name: "Venomstrike", q: 3, il: 20, rl: 15, cls: "Weapon", sub: "Dagger", cid: 2, sid: 15, st: 1, eq: "INVTYPE_WEAPON", ic: 135641, sp: 1800, bt: 2, xp: 0, tip: ["Venomstrike", "Binds when picked up", "One-Hand"], ft: 1790998650, lt: 1790998650 } },
    loot: { "c:2955": { k: "c", id: 2955, w: 4, items: { "2589": { n: 3, min: 1, max: 3 }, "3184": { n: 1, min: 1, max: 1, q: false } }, ft: 1790998640, lt: 1790998700 }, "f:1412": { k: "f", id: 1412, w: 2, items: { "6291": { n: 2, min: 1, max: 1 } }, ft: 1790998640, lt: 1790998700 } },
    vendors: { "3077": { id: 3077, items: { "4540": { p: 25, st: 5 }, "2092": { p: 30, st: 1, lim: 2 } }, rep: true, ft: 1790998660, lt: 1790998660 } },
  },
  events: [{ t: 1790998608, k: "login", d: { level: 5 } }],
  state: { level: 5 },
});

const ctx = { uploadId: "u1", accountId: "acct-a", characterId: "c1", sessionId: "s1", realmId: 7 };

describe("observationsFor", () => {
  it("turns a session into typed observation rows", () => {
    const rows = observationsFor(session, ctx);
    const creature = rows.filter((r) => r.entity_type === "creature" && r.entity_id === 3063);
    expect(creature.find((r) => r.field === "name")).toMatchObject({ value_kind: "text", value_text: "Krang Stonehoof", locale: "enUS", build: 70003 });
    expect(creature.find((r) => r.field === "health")).toMatchObject({ value_kind: "json", value_json: { level: 14, max: 500 } });
    expect(creature.find((r) => r.field === "role:trainer")).toMatchObject({ value_kind: "bool", value_num: 1 });
    expect(creature.find((r) => r.field === "position")).toMatchObject({ map_id: 1412, pos_x: 0.5, world_x: -351.8, instance_id: 1 });
    expect(rows.find((r) => r.entity_type === "map" && r.field === "name")?.value_text).toBe("Mulgore");
    expect(rows.find((r) => r.entity_type === "area" && r.field === "map")?.value_num).toBe(1412);
    expect(rows.find((r) => r.entity_type === "taxi_node" && r.field === "name")).toMatchObject({ source: "client_catalog" });
    expect(rows.every((r) => r.server_time.endsWith("Z"))).toBe(true);
  });
  it("records flight routes and the flight master as encounter facts", () => {
    const rows = observationsFor(session, ctx);
    expect(rows.find((r) => r.entity_type === "taxi_node" && r.field === "taxi_route")).toMatchObject({ source: "encounter", value_json: { to: 25 } });
    expect(rows.find((r) => r.entity_type === "taxi_node" && r.field === "flight_master")?.value_num).toBe(2995);
  });
  it("records map art layout as client catalog facts", () => {
    const rows = observationsFor(session, ctx);
    const layer = rows.find((r) => r.entity_type === "map" && r.field === "art_layer");
    expect(layer).toMatchObject({ source: "client_catalog", value_kind: "json", value_json: { w: 1002, tw: 256, t: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } });
    expect(rows.filter((r) => r.entity_type === "map" && r.field === "art_overlay")).toHaveLength(1);
  });
  it("records items with their tooltip and the icon as a client catalog", () => {
    const rows = observationsFor(session, ctx);
    const item = rows.filter((r) => r.entity_type === "item" && r.entity_id === 3184);
    expect(item.find((r) => r.field === "name")?.value_text).toBe("Venomstrike");
    expect(item.find((r) => r.field === "quality")?.value_num).toBe(3);
    expect(item.find((r) => r.field === "icon")).toMatchObject({ value_num: 135641, source: "client_catalog" });
    expect(item.find((r) => r.field === "tooltip")?.value_json).toEqual(["Venomstrike", "Binds when picked up", "One-Hand"]);
  });
  it("records loot windows and wares on their source", () => {
    const rows = observationsFor(session, ctx);
    expect(rows.find((r) => r.entity_type === "creature" && r.entity_id === 2955 && r.field === "loot_window")?.value_num).toBe(4);
    expect(rows.filter((r) => r.entity_type === "creature" && r.entity_id === 2955 && r.field === "drops")).toHaveLength(2);
    expect(rows.find((r) => r.entity_type === "map" && r.entity_id === 1412 && r.field === "drops")?.value_json).toMatchObject({ item: 6291, n: 2 });
    const wares = rows.filter((r) => r.entity_type === "creature" && r.entity_id === 3077 && r.field === "sells").map((r) => r.value_json);
    expect(wares).toContainEqual({ item: 4540, price: 25, stack: 5, limited: null, ec: null });
    expect(wares).toContainEqual({ item: 2092, price: 30, stack: 1, limited: 2, ec: null });
    expect(rows.find((r) => r.entity_type === "creature" && r.entity_id === 3077 && r.field === "repairs")?.value_num).toBe(1);
  });
  it("drops player pets sent by older add-ons", () => {
    const rows = observationsFor(session, ctx);
    expect(rows.some((r) => r.entity_type === "creature" && r.entity_id === 1555)).toBe(false);
  });
});

function obs(partial: Partial<Obs> & { field: string; account_id: string | null }): Obs {
  return {
    build: 70003, locale: "enUS", server_time: "2026-10-03T00:00:00.000Z", value_kind: "text", value_num: null, value_text: null, value_json: null,
    map_id: null, pos_x: null, pos_y: null, instance_id: null, world_x: null, world_y: null, source: "encounter", tombstoned: false,
    ...partial,
  };
}
const ref = { flavor: "era", entityType: "creature", entityId: 3063, entityKey: "" };

describe("computeFacts", () => {
  it("one contributor is unconfirmed; a trusted one counts double and confirms", () => {
    const rows = computeFacts(ref, [obs({ field: "name", account_id: "a", value_text: "Krang" })], new Set());
    expect(rows[0]).toMatchObject({ status: "unconfirmed", contributor_count: 1, observation_count: 1 });
    const trusted = computeFacts(ref, [obs({ field: "name", account_id: "a", value_text: "Krang" })], new Set(["a"]));
    expect(trusted[0]?.status).toBe("confirmed");
  });

  it("two accounts agreeing confirms; repeated observations by one account do not", () => {
    const same = [obs({ field: "name", account_id: "a", value_text: "Krang" }), obs({ field: "name", account_id: "a", value_text: "Krang" })];
    expect(computeFacts(ref, same, new Set())[0]?.status).toBe("unconfirmed");
    const two = [...same, obs({ field: "name", account_id: "b", value_text: "Krang" })];
    expect(computeFacts(ref, two, new Set())[0]).toMatchObject({ status: "confirmed", contributor_count: 2, observation_count: 3 });
  });

  it("conflicting scalar values without a supermajority are disputed; a supermajority wins", () => {
    const split = [
      obs({ field: "level_max", account_id: "a", value_kind: "num", value_num: 14 }),
      obs({ field: "level_max", account_id: "b", value_kind: "num", value_num: 14 }),
      obs({ field: "level_max", account_id: "c", value_kind: "num", value_num: 15 }),
      obs({ field: "level_max", account_id: "d", value_kind: "num", value_num: 15 }),
    ];
    const statuses = computeFacts(ref, split, new Set()).map((r) => r.status);
    expect(statuses).toEqual(["disputed", "disputed"]);
    const majority = [
      ...["a", "b", "c", "d", "e"].map((id) => obs({ field: "level_max", account_id: id, value_kind: "num", value_num: 14 })),
      obs({ field: "level_max", account_id: "z", value_kind: "num", value_num: 15 }),
    ];
    const rows = computeFacts(ref, majority, new Set());
    expect(rows.find((r) => r.value_num === 14)?.status).toBe("confirmed");
    expect(rows.find((r) => r.value_num === 15)?.status).toBe("unconfirmed");
  });

  it("multi-valued fields are sets, not disputes, and text is keyed per locale", () => {
    const rows = computeFacts(ref, [
      obs({ field: "health", account_id: "a", value_kind: "json", value_json: { level: 14, max: 500 } }),
      obs({ field: "health", account_id: "b", value_kind: "json", value_json: { level: 15, max: 540 } }),
      obs({ field: "name", account_id: "a", value_text: "Krang Stonehoof" }),
      obs({ field: "name", account_id: "b", value_text: "Krang Steinhuf", locale: "deDE" }),
    ], new Set());
    expect(rows.filter((r) => r.field === "health").map((r) => r.status)).toEqual(["unconfirmed", "unconfirmed"]);
    expect(rows.filter((r) => r.field === "name").map((r) => [r.locale, r.status])).toEqual([["enUS", "unconfirmed"], ["deDE", "unconfirmed"]]);
  });

  it("tracks build intervals across observations", () => {
    const rows = computeFacts(ref, [
      obs({ field: "name", account_id: "a", value_text: "Krang", build: 70003 }),
      obs({ field: "name", account_id: "b", value_text: "Krang", build: 70100, server_time: "2026-11-01T00:00:00.000Z" }),
    ], new Set());
    expect(rows[0]).toMatchObject({ first_build: 70003, last_build: 70100, first_seen_at: "2026-10-03T00:00:00.000Z", last_seen_at: "2026-11-01T00:00:00.000Z" });
  });
});

describe("computePositions", () => {
  it("clusters nearby points per map and averages world coordinates", () => {
    const p = (x: number, y: number, map = 1412, acct = "a") => obs({ field: "position", account_id: acct, value_kind: "json", value_json: { k: "target" }, map_id: map, pos_x: x, pos_y: y, instance_id: 1, world_x: x * 1000, world_y: y * 1000 });
    const clusters = computePositions([p(0.5, 0.8), p(0.505, 0.805, 1412, "b"), p(0.9, 0.1), p(0.5, 0.8, 1414)]);
    expect(clusters).toHaveLength(3);
    const big = clusters.find((c) => c.n === 2)!;
    expect(big.map).toBe(1412);
    expect(big.x).toBeCloseTo(0.5025, 4);
    expect(big.accounts.size).toBe(2);
    expect(big.wx).toBeCloseTo(502.5, 1);
  });
});

describe("computeRelations", () => {
  const ref = { flavor: "era", entityType: "creature", entityId: 2955, entityKey: "" };
  it("turns loot windows into drop rates and wares into priced edges", () => {
    const rows = computeRelations(ref, [
      obs({ field: "loot_window", account_id: "a", value_kind: "num", value_num: 4 }),
      obs({ field: "loot_window", account_id: "b", value_kind: "num", value_num: 6 }),
      obs({ field: "drops", account_id: "a", value_kind: "json", value_json: { item: 2589, n: 3, min: 1, max: 3 } }),
      obs({ field: "drops", account_id: "b", value_kind: "json", value_json: { item: 2589, n: 4, min: 2, max: 5, quest: false } }),
      obs({ field: "drops", account_id: "b", value_kind: "json", value_json: { item: 3184, n: 1, min: 1, max: 1 } }),
      obs({ field: "sells", account_id: "a", value_kind: "json", value_json: { item: 4540, price: 25, stack: 5, limited: null }, server_time: "2026-10-03T00:00:00.000Z" }),
      obs({ field: "sells", account_id: "a", value_kind: "json", value_json: { item: 4540, price: 24, stack: 5, limited: null }, server_time: "2026-10-04T00:00:00.000Z" }),
    ], new Set());
    const cloth = rows.find((r) => r.rel === "drops" && r.to_id === 2589)!;
    expect(cloth).toMatchObject({ numerator: 7, denominator: 10, contributor_count: 2, status: "confirmed", attrs: { min: 1, max: 5 } });
    expect(rows.find((r) => r.rel === "drops" && r.to_id === 3184)).toMatchObject({ numerator: 1, denominator: 10, status: "unconfirmed" });
    expect(rows.find((r) => r.rel === "sells")).toMatchObject({ numerator: 2, denominator: 0, attrs: { price: 24, stack: 5 } });
  });
  it("keeps relation inputs out of the facts", () => {
    const facts = computeFacts(ref, [obs({ field: "loot_window", account_id: "a", value_kind: "num", value_num: 4 }), obs({ field: "name", account_id: "a", value_text: "Plainstrider" })], new Set());
    expect(facts.map((f) => f.field)).toEqual(["name"]);
  });
});
