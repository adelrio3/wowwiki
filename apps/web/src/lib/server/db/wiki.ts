/** Read helpers for World Wiki pages. Public data only; uses the service client for speed. */
import { serviceClient } from "../supabase";
import { DEFAULT_LOCALE } from "@compendium/game-meta";
import { MOCK, mockCreatureFacts, mockListed, mockMaps, mockPositions, mockSummaries } from "./mock";
import { kindSignalsFromFacts, unitKind } from "$lib/wiki-format";

export interface FactRow {
  field: string;
  locale: string;
  value_kind: string;
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  first_build: number;
  last_build: number;
  contributor_count: number;
  observation_count: number;
  status: string;
  source: string;
}

export interface PositionRow {
  map_id: number | null;
  cluster_x: number | null;
  cluster_y: number | null;
  observation_count: number;
  contributor_count: number;
}

export async function wikiCounts() {
  if (MOCK) return { creatures: 128, areas: 41, zones: 6, contributors: 3 };
  const db = serviceClient();
  const [c, a, m, k] = await Promise.all([
    db.from("facts").select("entity_id", { count: "exact", head: true }).eq("entity_type", "creature").eq("field", "name").eq("locale", DEFAULT_LOCALE),
    db.from("facts").select("entity_id", { count: "exact", head: true }).eq("entity_type", "area").eq("field", "name").eq("locale", DEFAULT_LOCALE),
    db.from("facts").select("entity_id", { count: "exact", head: true }).eq("entity_type", "map").eq("field", "name").eq("locale", DEFAULT_LOCALE),
    db.from("accounts").select("id", { count: "exact", head: true }),
  ]);
  return { creatures: c.count ?? 0, areas: a.count ?? 0, zones: m.count ?? 0, contributors: k.count ?? 0 };
}

/** Most recently observed entities of a kind, by last_seen_at. */
export async function recentEntities(flavor: string, entityType: string, limit = 8): Promise<Listed[]> {
  if (MOCK) return (mockListed[entityType as keyof typeof mockListed] ?? []).slice(0, limit);
  const db = serviceClient();
  const { data } = await db
    .from("facts")
    .select("entity_id, value_text, status, contributor_count, last_build, last_seen_at")
    .eq("flavor", flavor)
    .eq("entity_type", entityType)
    .eq("field", "name")
    .eq("locale", DEFAULT_LOCALE)
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({ entity_id: r.entity_id, name: r.value_text ?? "", status: r.status, contributor_count: r.contributor_count, last_build: r.last_build }));
}

export async function entityFacts(flavor: string, entityType: string, entityId: number, entityKey = ""): Promise<FactRow[]> {
  if (MOCK) {
    if (entityType === "creature") return mockCreatureFacts[entityId] ?? [];
    if (entityType === "map" && mockMaps[entityId]) return [{ field: "name", locale: "enUS", value_kind: "text", value_num: null, value_text: mockMaps[entityId]!, value_json: null, first_build: 70003, last_build: 70003, contributor_count: 1, observation_count: 5, status: "confirmed", source: "encounter" }, { field: "map_type", locale: "", value_kind: "num", value_num: 3, value_text: null, value_json: null, first_build: 70003, last_build: 70003, contributor_count: 1, observation_count: 5, status: "confirmed", source: "encounter" }];
    return [];
  }
  const db = serviceClient();
  const { data } = await db
    .from("facts")
    .select("field, locale, value_kind, value_num, value_text, value_json, first_build, last_build, contributor_count, observation_count, status, source")
    .eq("flavor", flavor)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("entity_key", entityKey)
    .order("observation_count", { ascending: false });
  return (data ?? []) as FactRow[];
}

export async function entityPositions(flavor: string, entityType: string, entityId: number): Promise<PositionRow[]> {
  if (MOCK) return mockPositions[entityId] ?? [];
  const db = serviceClient();
  const { data } = await db
    .from("positions")
    .select("map_id, cluster_x, cluster_y, observation_count, contributor_count")
    .eq("flavor", flavor)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("observation_count", { ascending: false });
  return (data ?? []) as PositionRow[];
}

/** Pick the best text value for a field: preferred locale, then enUS, then any; most observed wins. */
export function pickText(facts: FactRow[], field: string, locale = DEFAULT_LOCALE): FactRow | undefined {
  const candidates = facts.filter((f) => f.field === field && f.value_kind === "text");
  return candidates.find((f) => f.locale === locale) ?? candidates.find((f) => f.locale === DEFAULT_LOCALE) ?? candidates[0];
}

export function pickNum(facts: FactRow[], field: string): FactRow | undefined {
  return facts.find((f) => f.field === field && (f.value_kind === "num" || f.value_kind === "bool"));
}

export function allOf(facts: FactRow[], field: string): FactRow[] {
  return facts.filter((f) => f.field === field);
}

export async function mapNames(flavor: string, mapIds: number[]): Promise<Record<number, string>> {
  if (!mapIds.length) return {};
  if (MOCK) return Object.fromEntries(mapIds.map((id) => [id, mockMaps[id] ?? `Map ${id}`]));
  const db = serviceClient();
  const { data } = await db
    .from("facts")
    .select("entity_id, value_text, locale")
    .eq("flavor", flavor)
    .eq("entity_type", "map")
    .eq("field", "name")
    .in("entity_id", mapIds);
  const out: Record<number, string> = {};
  for (const r of data ?? []) if (r.locale === DEFAULT_LOCALE || !out[r.entity_id]) out[r.entity_id] = r.value_text ?? "";
  return out;
}

export interface Listed {
  entity_id: number;
  name: string;
  status: string;
  contributor_count: number;
  last_build: number;
}

export async function listEntities(flavor: string, entityType: string, limit = 100, search = ""): Promise<Listed[]> {
  if (MOCK) return (mockListed[entityType as keyof typeof mockListed] ?? []).filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase())).slice(0, limit);
  const db = serviceClient();
  let q = db
    .from("facts")
    .select("entity_id, value_text, status, contributor_count, last_build")
    .eq("flavor", flavor)
    .eq("entity_type", entityType)
    .eq("field", "name")
    .eq("locale", DEFAULT_LOCALE)
    .order("observation_count", { ascending: false })
    .limit(limit);
  if (search) q = q.ilike("value_text", `%${search.replace(/[%_]/g, "")}%`);
  const { data } = await q;
  return (data ?? []).map((r) => ({ entity_id: r.entity_id, name: r.value_text ?? "", status: r.status, contributor_count: r.contributor_count, last_build: r.last_build }));
}

/** Creatures with positions on a map, with their names. */
export async function creaturesOnMap(flavor: string, mapId: number, limit = 200) {
  if (MOCK) return mockSummaries.filter((c) => (mockPositions[c.entity_id] ?? []).some((p) => p.map_id === mapId)).map((c) => ({ entity_id: c.entity_id, name: c.name, status: c.status, positions: (mockPositions[c.entity_id] ?? []).filter((p) => p.map_id === mapId).map((p) => ({ entity_id: c.entity_id, observation_count: p.observation_count, cluster_x: p.cluster_x, cluster_y: p.cluster_y })) }));
  const db = serviceClient();
  const { data: pos } = await db
    .from("positions")
    .select("entity_id, observation_count, cluster_x, cluster_y")
    .eq("flavor", flavor)
    .eq("entity_type", "creature")
    .eq("map_id", mapId)
    .order("observation_count", { ascending: false })
    .limit(limit);
  const ids = [...new Set((pos ?? []).map((p) => p.entity_id))];
  if (!ids.length) return [];
  const { data: names } = await db
    .from("facts")
    .select("entity_id, value_text, locale, status")
    .eq("flavor", flavor)
    .eq("entity_type", "creature")
    .eq("field", "name")
    .in("entity_id", ids);
  const byId = new Map<number, { name: string; status: string }>();
  for (const n of names ?? []) if (n.locale === DEFAULT_LOCALE || !byId.has(n.entity_id)) byId.set(n.entity_id, { name: n.value_text ?? "", status: n.status });
  return ids.map((id) => ({ entity_id: id, name: byId.get(id)?.name ?? `#${id}`, status: byId.get(id)?.status ?? "unconfirmed", positions: (pos ?? []).filter((p) => p.entity_id === id) }));
}

export async function areasOnMap(flavor: string, mapId: number) {
  if (MOCK) return mapId === 1412 ? mockListed.area : [];
  const db = serviceClient();
  const { data: mapFacts } = await db.from("facts").select("entity_id").eq("flavor", flavor).eq("entity_type", "area").eq("field", "map").eq("value_num", mapId);
  const ids = [...new Set((mapFacts ?? []).map((r) => r.entity_id))];
  if (!ids.length) return [];
  const { data: names } = await db.from("facts").select("entity_id, value_text, locale, status").eq("flavor", flavor).eq("entity_type", "area").eq("field", "name").in("entity_id", ids);
  const byId = new Map<number, { name: string; status: string }>();
  for (const n of names ?? []) if (n.locale === DEFAULT_LOCALE || !byId.has(n.entity_id)) byId.set(n.entity_id, { name: n.value_text ?? "", status: n.status });
  return ids.map((id) => ({ entity_id: id, name: byId.get(id)?.name ?? `#${id}`, status: byId.get(id)?.status ?? "unconfirmed" })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildsFor(flavor: string) {
  if (MOCK) return [{ build: 70003, patch: "1.15.9", expansion: "Classic", classified: true }];
  const db = serviceClient();
  const { data } = await db.from("builds").select("build, patch, expansion, classified").eq("flavor", flavor).order("build");
  return data ?? [];
}

export interface CreatureListed extends Listed {
  level_min: number | null;
  level_max: number | null;
  creature_type: string | null;
  classification: string | null;
  /** NPC or Creature per docs/03 presentation rule (D-0038) */
  kind: "NPC" | "Creature";
}

/** Names plus level/type/classification for a set of creature ids. */
export async function creatureSummaries(flavor: string, ids: number[]): Promise<Map<number, CreatureListed>> {
  const out = new Map<number, CreatureListed>();
  if (!ids.length) return out;
  if (MOCK) { for (const c of mockSummaries) if (ids.includes(c.entity_id)) out.set(c.entity_id, c); return out; }
  const db = serviceClient();
  const { data } = await db
    .from("facts")
    .select("entity_id, field, locale, value_text, value_num, value_json, status, contributor_count, last_build")
    .eq("flavor", flavor)
    .eq("entity_type", "creature")
    .or("field.in.(name,level_min,level_max,creature_type,classification,subtitle,civilian,attackable,reaction),field.like.role:*")
    .in("entity_id", ids);
  for (const id of ids) out.set(id, { entity_id: id, name: `#${id}`, status: "unconfirmed", contributor_count: 0, last_build: 0, level_min: null, level_max: null, creature_type: null, classification: null, kind: "Creature" });
  const byEntity = new Map<number, typeof data>();
  for (const r of data ?? []) {
    byEntity.set(r.entity_id, [...(byEntity.get(r.entity_id) ?? []), r]);
    const c = out.get(r.entity_id)!;
    if (r.field === "name" && (r.locale === DEFAULT_LOCALE || c.name.startsWith("#"))) { c.name = r.value_text ?? c.name; c.status = r.status; c.contributor_count = r.contributor_count; c.last_build = r.last_build; }
    else if (r.field === "level_min") c.level_min = r.value_num;
    else if (r.field === "level_max") c.level_max = r.value_num;
    else if (r.field === "creature_type" && (r.locale === DEFAULT_LOCALE || !c.creature_type)) c.creature_type = r.value_text;
    else if (r.field === "classification") c.classification = r.value_text;
  }
  for (const [id, rows] of byEntity) {
    const c = out.get(id)!;
    c.kind = unitKind(kindSignalsFromFacts((rows ?? []).map((r) => ({ field: r.field, value_kind: "", value_num: r.value_num, value_text: r.value_text, value_json: (r as { value_json?: unknown }).value_json ?? null }))));
  }
  return out;
}

export async function taxiNodesOnMap(flavor: string, mapId: number) {
  if (MOCK) return mapId === 1412 ? [{ entity_id: 22, name: "Thunder Bluff, Mulgore", x: 0.39, y: 0.27 }] : [];
  const db = serviceClient();
  const { data: onMap } = await db.from("facts").select("entity_id").eq("flavor", flavor).eq("entity_type", "taxi_node").eq("field", "position").contains("value_json", {});
  const ids = [...new Set((onMap ?? []).map((r) => r.entity_id))];
  if (!ids.length) return [];
  const { data: names } = await db.from("facts").select("entity_id, value_text, locale").eq("flavor", flavor).eq("entity_type", "taxi_node").eq("field", "name").in("entity_id", ids);
  const { data: pos } = await db.from("positions").select("entity_id, cluster_x, cluster_y").eq("flavor", flavor).eq("entity_type", "taxi_node").eq("map_id", mapId);
  const byId = new Map<number, string>();
  for (const n of names ?? []) if (n.locale === DEFAULT_LOCALE || !byId.has(n.entity_id)) byId.set(n.entity_id, n.value_text ?? "");
  return (pos ?? []).map((p) => ({ entity_id: p.entity_id, name: byId.get(p.entity_id) ?? `#${p.entity_id}`, x: p.cluster_x, y: p.cluster_y }));
}
