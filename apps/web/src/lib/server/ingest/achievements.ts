/**
 * Achievement evaluation on ingest (docs/06): gather a character's state from
 * the Journal tables, run the pure engine, store progress per achievement.
 * Re-running for every character after a catalog change gives the same dates.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { catalogFor, evaluate, type CharacterState } from "@compendium/achievements";
import { bootstrapLayouts } from "../map-art";

/** The continent a map belongs to, through the client's map tree. */
export function continentOf(flavor: string, mapId: number | null): number | null {
  if (mapId === null) return null;
  const layouts = bootstrapLayouts(flavor);
  let cur = layouts[String(mapId)];
  let guard = 0;
  while (cur && guard++ < 10) {
    if (cur.type === 2) return Number(Object.entries(layouts).find(([, v]) => v === cur)![0]);
    const next = layouts[String(cur.parent)];
    if (!next) return null;
    cur = next;
  }
  return null;
}

export async function characterState(db: SupabaseClient, characterId: string, flavor: string): Promise<CharacterState> {
  const [{ data: ch }, { data: levels }, { data: state }, { data: stats }] = await Promise.all([
    db.from("characters").select("level").eq("id", characterId).maybeSingle(),
    db.from("journal_events").select("kind, at, payload").eq("character_id", characterId).in("kind", ["level_up", "login"]).order("at", { ascending: true }).limit(5000),
    db.from("character_state").select("kind, key, value_json, as_of").eq("character_id", characterId).in("kind", ["quest", "explored", "taxi", "pet"]).limit(20000),
    db.from("character_stats").select("stat_key, value_num").eq("character_id", characterId).in("stat_key", ["hardcore"]),
  ]);
  const levelAt: Record<number, string> = {};
  for (const e of levels ?? []) {
    const lvl = Number((e.payload as { level?: number })?.level);
    if (Number.isInteger(lvl) && !(lvl in levelAt)) levelAt[lvl] = e.at;
  }
  const quests = (state ?? []).filter((s) => s.kind === "quest").map((s) => ({ id: Number(s.key), at: ((s.value_json as { at?: string | null })?.at ?? null), continent: null as number | null }));
  if (quests.length) {
    const { data: pos } = await db.from("positions").select("entity_id, map_id, observation_count").eq("flavor", flavor).eq("entity_type", "quest").in("entity_id", quests.map((q) => q.id)).order("observation_count", { ascending: false }).limit(10000);
    const mapOf = new Map<number, number>();
    for (const p of pos ?? []) if (p.map_id !== null && !mapOf.has(p.entity_id)) mapOf.set(p.entity_id, p.map_id);
    for (const q of quests) q.continent = continentOf(flavor, mapOf.get(q.id) ?? null);
  }
  return {
    level: Number(ch?.level ?? 1),
    levelAt,
    hardcore: (stats ?? []).some((s) => s.stat_key === "hardcore" && Number(s.value_num) === 1),
    quests,
    explored: (state ?? []).filter((s) => s.kind === "explored").map((s) => ({ areaId: Number(s.key), at: s.as_of })),
    taxi: (state ?? []).filter((s) => s.kind === "taxi").map((s) => ({ nodeId: Number(s.key), at: s.as_of })),
    pets: (state ?? []).filter((s) => s.kind === "pet").length,
  };
}

export async function evaluateCharacter(db: SupabaseClient, characterId: string, flavor: string): Promise<void> {
  const catalog = catalogFor(flavor);
  if (!catalog) return;
  const state = await characterState(db, characterId, flavor);
  const progress = evaluate(catalog, state);
  const now = new Date().toISOString();
  const rows = progress.map((p) => ({ character_id: characterId, achievement_key: p.key, criteria_json: { criteria: p.criteria, fraction: p.fraction, version: catalog.version }, earned_at: p.earnedAt ?? (p.earned ? now : null), points: p.points, updated_at: now }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("achievement_progress").upsert(rows.slice(i, i + 200), { onConflict: "character_id,achievement_key" });
    if (error) throw new Error(`achievement progress upsert failed: ${error.message}`);
  }
}
