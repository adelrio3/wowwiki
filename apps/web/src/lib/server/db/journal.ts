/** Read helpers for the Journal. Caller must have verified ownership (locals.user). */
import { serviceClient } from "../supabase";
import { MOCK, mockCharacterDetail, mockCharacters, mockUploads } from "./mock";

export async function accountFor(userId: string) {
  if (MOCK) return { id: userId, display_name: "Eigan", battletag: null, visibility: {}, role: "owner", trusted: true, link_token: "mock-token", created_at: "2026-10-01T00:00:00.000Z" };
  const db = serviceClient();
  const { data } = await db.from("accounts").select("id, display_name, battletag, visibility, role, trusted, link_token, created_at").eq("id", userId).maybeSingle();
  return data;
}

export async function charactersFor(accountId: string) {
  if (MOCK) return mockCharacters;
  const db = serviceClient();
  const { data } = await db
    .from("characters")
    .select("id, flavor, name, class, race, faction, level, last_seen_at, realms(name)")
    .eq("account_id", accountId)
    .order("last_seen_at", { ascending: false });
  return data ?? [];
}

export async function characterDetail(accountId: string, characterId: string) {
  if (MOCK) return characterId === "c1" ? mockCharacterDetail : null;
  const db = serviceClient();
  const { data: c } = await db.from("characters").select("id, flavor, name, class, race, faction, level, player_guid, created_at, last_seen_at, realms(name)").eq("id", characterId).eq("account_id", accountId).maybeSingle();
  if (!c) return null;
  const [{ data: stats }, { data: events }, { data: sessions }, { count: explored }, { data: taxi }, { data: visits }, { data: petRows }, { count: questsCompleted }, { data: questRows }] = await Promise.all([
    db.from("character_stats").select("stat_key, value_num").eq("character_id", characterId),
    db.from("journal_events").select("kind, at, payload, map_id").eq("character_id", characterId).order("at", { ascending: false }).limit(300),
    db.from("sessions").select("seq, started_at, ended_at, build, level_start, level_end").eq("character_id", characterId).order("seq", { ascending: false }).limit(50),
    db.from("character_state").select("key", { count: "exact", head: true }).eq("character_id", characterId).eq("kind", "explored"),
    db.from("character_state").select("key, value_json, as_of").eq("character_id", characterId).eq("kind", "taxi"),
    db.from("journal_events").select("map_id, at").eq("character_id", characterId).eq("kind", "zone_enter").not("map_id", "is", null).order("at", { ascending: true }).limit(2000),
    db.from("character_state").select("key, value_json").eq("character_id", characterId).eq("kind", "pet"),
    db.from("character_state").select("key", { count: "exact", head: true }).eq("character_id", characterId).eq("kind", "quest"),
    db.from("character_state").select("key, value_json, as_of").eq("character_id", characterId).eq("kind", "quest").order("as_of", { ascending: false }).limit(400),
  ]);
  const recentQuests = (questRows ?? []).map((r) => { const v = r.value_json as { title?: string | null; at?: string | null }; return { id: Number(r.key), title: v.title ?? null, at: v.at ?? null }; }).filter((q) => q.at).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 8);
  const pets = (petRows ?? []).map((p) => { const v = p.value_json as { name?: string | null; family?: string | null; level?: number | null; skills?: Array<{ n: string; r?: number }>; active?: boolean }; return { id: p.key.startsWith("stable:") ? null : Number(p.key), name: v.name ?? null, family: v.family ?? null, level: v.level ?? null, skills: v.skills ?? [], active: v.active ?? false }; }).sort((a, b) => Number(b.active) - Number(a.active) || (a.name ?? "").localeCompare(b.name ?? ""));
  const flightPaths = (taxi ?? []).map((t) => ({ nodeId: Number(t.key), name: ((t.value_json as { name?: string | null })?.name ?? `#${t.key}`), mapId: (t.value_json as { map?: number | null })?.map ?? null, since: t.as_of })).sort((a, b) => a.name.localeCompare(b.name));
  const firstVisit = new Map<number, string>();
  for (const v of visits ?? []) if (v.map_id !== null && !firstVisit.has(v.map_id)) firstVisit.set(v.map_id, v.at);
  return { character: c, stats: Object.fromEntries((stats ?? []).map((s) => [s.stat_key, Number(s.value_num)])), events: events ?? [], sessions: sessions ?? [], exploredCount: explored ?? 0, questsCompleted: questsCompleted ?? 0, recentQuests, pets, flightPaths, zonesVisited: [...firstVisit].map(([mapId, at]) => ({ mapId, at })) };
}

export async function uploadsFor(accountId: string) {
  if (MOCK) return mockUploads;
  const db = serviceClient();
  const { data } = await db.from("uploads").select("id, flavor, received_at, ingest_status, ingest_error, observation_count, byte_size").eq("account_id", accountId).order("received_at", { ascending: false }).limit(20);
  return data ?? [];
}

export async function rotateLinkToken(accountId: string): Promise<string> {
  const db = serviceClient();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  await db.from("accounts").update({ link_token: token }).eq("id", accountId);
  return token;
}
