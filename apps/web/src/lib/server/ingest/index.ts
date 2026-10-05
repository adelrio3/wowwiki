/**
 * Ingest pipeline (docs/02 layers L0 → L1 → L2, Journal).
 *
 * Idempotent per upload: sessions already present for (character, seq) are
 * skipped, so re-running an upload never double counts. The raw file is the
 * source; the parse here is the authoritative one.
 */
import { parseSavedVariables } from "@compendium/lua-parser";
import { parseSavedVariablesDocument, type CreatureRecord, type ItemRecord, type Position, type QuestRecord, type SavedVariables, type Session } from "@compendium/schema";
import { findBuild, guessExpansion } from "@compendium/game-meta";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "../supabase";
import { aggregateEntities, type EntityRef } from "./aggregate";
import { evaluateCharacter } from "./achievements";

export interface IngestResult {
  uploadId: string;
  status: "ingested" | "failed";
  error?: string;
  observations: number;
  sessions: number;
  ack: Record<string, number>;
}

export type ObservationRow = {
  upload_id: string;
  account_id: string | null;
  character_id: string;
  session_id: string;
  flavor: string;
  build: number;
  locale: string;
  region: number | null;
  realm_id: number | null;
  server_time: string;
  entity_type: string;
  entity_id: number;
  entity_key: string;
  field: string;
  value_kind: "num" | "text" | "json" | "bool";
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  map_id: number | null;
  pos_x: number | null;
  pos_y: number | null;
  instance_id: number | null;
  world_x: number | null;
  world_y: number | null;
  source: "encounter" | "client_catalog";
};

const iso = (t: number) => new Date(t * 1000).toISOString();

export async function ingestUpload(uploadId: string): Promise<IngestResult> {
  const db = serviceClient();
  const { data: upload, error } = await db.from("uploads").select("*").eq("id", uploadId).single();
  if (error || !upload) return { uploadId, status: "failed", error: "upload not found", observations: 0, sessions: 0, ack: {} };
  if (upload.ingest_status === "ingested") {
    return { uploadId, status: "ingested", observations: upload.observation_count ?? 0, sessions: 0, ack: await currentAck(db, upload.account_id) };
  }
  await db.from("uploads").update({ ingest_status: "ingesting", ingest_error: null }).eq("id", uploadId);

  try {
    const { data: file, error: dlErr } = await db.storage.from("uploads").download(upload.storage_path);
    if (dlErr || !file) throw new Error(`raw file missing: ${dlErr?.message ?? "no data"}`);
    const text = await file.text();
    const sv = parseSavedVariablesDocument(parseSavedVariables(text));

    const accountId: string | null = upload.account_id ?? null;
    await db.from("addon_identities").upsert(
      { id: sv.identity, account_id: accountId, flavor: upload.flavor, last_seen_at: new Date().toISOString() },
      { onConflict: "id" },
    );

    let observations = 0;
    let sessionsWritten = 0;
    const touched = new Map<string, EntityRef>();
    const touchedCharacters = new Map<string, string>();

    for (const [guid, character] of Object.entries(sv.characters)) {
      const realmId = await upsertRealm(db, character.meta.flavor, character.meta.region ?? null, character.meta.realmNormalized ?? character.meta.realm, character.meta.realm, character.meta.realmId ?? null);
      const characterId = await upsertCharacter(db, accountId, guid, character.meta, realmId);
      touchedCharacters.set(characterId, character.meta.flavor);

      const seqs = Object.values(character.sessions).sort((a, b) => a.seq - b.seq);
      for (const session of seqs) {
        const sessionId = await insertSession(db, characterId, uploadId, session);
        if (!sessionId) continue; // already ingested
        sessionsWritten++;
        await ensureBuildRow(db, session);
        const rows = observationsFor(session, { uploadId, accountId, characterId, sessionId, realmId });
        observations += rows.length;
        for (let i = 0; i < rows.length; i += 500) {
          const { error: insErr } = await db.from("observations").insert(rows.slice(i, i + 500));
          if (insErr) throw new Error(`observations insert failed: ${insErr.message}`);
        }
        for (const r of rows) touched.set(`${r.flavor}|${r.entity_type}|${r.entity_id}|${r.entity_key}`, { flavor: r.flavor, entityType: r.entity_type, entityId: r.entity_id, entityKey: r.entity_key });
        await writeJournal(db, characterId, sessionId, session);
      }
      await db.from("characters").update({ last_seen_at: new Date().toISOString() }).eq("id", characterId);
    }

    await aggregateEntities(db, [...touched.values()]);
    // Achievements read quest positions, so they run after aggregation (docs/06).
    for (const [characterId, flavor] of touchedCharacters) await evaluateCharacter(db, characterId, flavor);

    const ack = await currentAck(db, accountId);
    await db
      .from("uploads")
      .update({ ingest_status: "ingested", ingested_at: new Date().toISOString(), observation_count: observations, schema_version: sv.schema, addon_version: sv.addonVersion })
      .eq("id", uploadId);
    return { uploadId, status: "ingested", observations, sessions: sessionsWritten, ack };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("uploads").update({ ingest_status: "failed", ingest_error: message.slice(0, 2000) }).eq("id", uploadId);
    return { uploadId, status: "failed", error: message, observations: 0, sessions: 0, ack: {} };
  }
}

/** Highest ingested session seq per character GUID for an account. */
export async function currentAck(db: SupabaseClient, accountId: string | null): Promise<Record<string, number>> {
  if (!accountId) return {};
  const { data: chars } = await db.from("characters").select("id, player_guid").eq("account_id", accountId);
  const ack: Record<string, number> = {};
  for (const c of chars ?? []) {
    const { data } = await db.from("sessions").select("seq").eq("character_id", c.id).order("seq", { ascending: false }).limit(1);
    if (data && data[0]) ack[c.player_guid] = data[0].seq;
  }
  return ack;
}

async function upsertRealm(db: SupabaseClient, flavor: string, region: number | null, slug: string, name: string, clientRealmId: number | null): Promise<number | null> {
  const r = region ?? 0;
  const { data: existing } = await db.from("realms").select("id").eq("flavor", flavor).eq("region", r).eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.from("realms").insert({ flavor, region: r, slug, name, client_realm_id: clientRealmId }).select("id").single();
  if (error) {
    const { data: again } = await db.from("realms").select("id").eq("flavor", flavor).eq("region", r).eq("slug", slug).maybeSingle();
    return again?.id ?? null;
  }
  return data.id;
}

async function upsertCharacter(db: SupabaseClient, accountId: string | null, guid: string, meta: SavedVariables["characters"][string]["meta"], realmId: number | null): Promise<string> {
  const row = {
    account_id: accountId,
    flavor: meta.flavor,
    region: meta.region ?? null,
    realm_id: realmId,
    player_guid: guid,
    name: meta.name,
    class_id: meta.classId ?? null,
    class: meta.class ?? null,
    race_id: meta.raceId ?? null,
    race: meta.race ?? null,
    faction: meta.faction ?? null,
    sex: meta.sex ?? null,
  };
  const { data: existing } = await db.from("characters").select("id, account_id").eq("flavor", meta.flavor).eq("player_guid", guid).maybeSingle();
  if (existing) {
    if (existing.account_id && accountId && existing.account_id !== accountId) {
      throw new Error(`character ${meta.name} is already linked to another account; held for review`);
    }
    await db.from("characters").update({ ...row, account_id: existing.account_id ?? accountId }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await db.from("characters").insert(row).select("id").single();
  if (error) throw new Error(`character insert failed: ${error.message}`);
  return data.id;
}

async function insertSession(db: SupabaseClient, characterId: string, uploadId: string, s: Session): Promise<string | null> {
  const { data: existing } = await db.from("sessions").select("id").eq("character_id", characterId).eq("seq", s.seq).maybeSingle();
  if (existing) return null;
  const { data, error } = await db
    .from("sessions")
    .insert({
      character_id: characterId,
      upload_id: uploadId,
      seq: s.seq,
      started_at: iso(s.ctx.started),
      ended_at: s.ctx.ended ? iso(s.ctx.ended) : null,
      flavor: s.ctx.flavor,
      build: s.ctx.build,
      reload: s.ctx.reload ?? false,
      level_start: s.ctx.levelStart ?? null,
      level_end: s.ctx.levelEnd ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`session insert failed: ${error.message}`);
  return data.id;
}

async function ensureBuildRow(db: SupabaseClient, s: Session): Promise<void> {
  const known = findBuild(s.ctx.flavor, s.ctx.build);
  if (known) return;
  await db
    .from("builds")
    .upsert({ flavor: s.ctx.flavor, build: s.ctx.build, patch: s.ctx.version, expansion: guessExpansion(s.ctx.flavor, s.ctx.version), interface: s.ctx.interface ?? null, classified: false }, { onConflict: "flavor,build", ignoreDuplicates: true });
}

export interface Ctx {
  uploadId: string;
  accountId: string | null;
  characterId: string;
  sessionId: string;
  realmId: number | null;
}

export function observationsFor(s: Session, c: Ctx): ObservationRow[] {
  const rows: ObservationRow[] = [];
  const base = {
    upload_id: c.uploadId,
    account_id: c.accountId,
    character_id: c.characterId,
    session_id: c.sessionId,
    flavor: s.ctx.flavor,
    build: s.ctx.build,
    locale: s.ctx.locale,
    region: s.ctx.region ?? null,
    realm_id: c.realmId,
  };
  const pos0 = { map_id: null, pos_x: null, pos_y: null, instance_id: null, world_x: null, world_y: null } as const;

  const push = (
    entityType: string,
    entityId: number,
    entityKey: string,
    field: string,
    value: { num?: number; text?: string; json?: unknown; bool?: boolean },
    t: number,
    pos?: Position,
    source: "encounter" | "client_catalog" = "encounter",
  ) => {
    const kind = value.text !== undefined ? "text" : value.num !== undefined ? "num" : value.bool !== undefined ? "bool" : "json";
    rows.push({
      ...base,
      server_time: iso(t),
      entity_type: entityType,
      entity_id: entityId,
      entity_key: entityKey,
      field,
      value_kind: kind,
      value_num: value.num ?? (value.bool !== undefined ? (value.bool ? 1 : 0) : null),
      value_text: value.text ?? null,
      value_json: value.json ?? null,
      ...(pos ? { map_id: pos.m ?? null, pos_x: pos.x ?? null, pos_y: pos.y ?? null, instance_id: pos.i ?? null, world_x: pos.wx ?? null, world_y: pos.wy ?? null } : pos0),
      source,
    });
  };

  const w = s.world;
  for (const cr of Object.values(w.creatures)) creatureObservations(cr, push);
  for (const m of Object.values(w.maps)) {
    if (m.name) push("map", m.id, "", "name", { text: m.name }, m.ft);
    if (m.type !== undefined) push("map", m.id, "", "map_type", { num: m.type }, m.ft);
    if (m.parent !== undefined) push("map", m.id, "", "parent", { num: m.parent }, m.ft);
    // Map art layout is a client catalog (D-0041): the base layer once, each explored piece as its own fact.
    if (m.art) push("map", m.id, "", "art_layer", { json: { w: m.art.w, h: m.art.h, tw: m.art.tw, th: m.art.th, t: m.art.t, aid: m.art.aid ?? null } }, m.ft, undefined, "client_catalog");
    for (const o of m.ovl ?? []) push("map", m.id, "", "art_overlay", { json: { w: o.w, h: o.h, x: o.x, y: o.y, t: o.t } }, m.ft, undefined, "client_catalog");
  }
  for (const a of Object.values(w.areas)) {
    if (a.name) push("area", a.id, "", "name", { text: a.name }, a.ft);
    if (a.m !== undefined) push("area", a.id, "", "map", { num: a.m }, a.ft);
    if (a.zone) push("area", a.id, "", "zone", { text: a.zone }, a.ft);
    if (a.sub) push("area", a.id, "", "sub", { text: a.sub }, a.ft);
    for (const p of a.pos ?? []) push("area", a.id, "", "position", { json: { k: p.k ?? "player" } }, p.t, p);
  }
  for (const [key, z] of Object.entries(w.zoneTexts)) {
    push("zone_text", 0, key, "zone", { text: z.zone }, z.ft);
    if (z.sub) push("zone_text", 0, key, "sub", { text: z.sub }, z.ft);
    if (z.m !== undefined) push("zone_text", 0, key, "map", { num: z.m }, z.ft);
    if (z.indoors) push("zone_text", 0, key, "indoors", { bool: true }, z.ft);
    for (const p of z.pos ?? []) push("zone_text", 0, key, "position", { json: { k: p.k ?? "player" } }, p.t, p);
  }
  for (const i of Object.values(w.instances)) {
    if (i.name) push("instance", i.id, "", "name", { text: i.name }, i.ft);
    if (i.type) push("instance", i.id, "", "type", { text: i.type }, i.ft);
    if (i.diff !== undefined) push("instance", i.id, "", "difficulty", { json: { id: i.diff, name: i.diffName ?? null, max: i.max ?? null } }, i.ft);
  }
  for (const it of Object.values(w.items)) itemObservations(it, push);
  for (const q of Object.values(w.quests)) questObservations(q, push);
  for (const tm of Object.values(w.tamed)) {
    push("creature", tm.id, "", "tamed", { bool: true }, tm.ft);
    if (tm.fam) push("creature", tm.id, "", "creature_family", { text: tm.fam }, tm.ft);
  }
  // Loot windows and wares are relation inputs (drop rates, prices), not facts of the source (docs/02 "relation").
  for (const l of Object.values(w.loot)) {
    const type = l.k === "c" ? "creature" : l.k === "o" ? "gameobject" : "map";
    if (l.w > 0) push(type, l.id, "", "loot_window", { num: l.w }, l.ft);
    for (const [itemId, d] of Object.entries(l.items)) push(type, l.id, "", "drops", { json: { item: Number(itemId), n: d.n, min: d.min ?? null, max: d.max ?? null, quest: d.q ?? false } }, l.ft);
  }
  for (const v of Object.values(w.vendors)) {
    if (v.rep) push("creature", v.id, "", "repairs", { bool: true }, v.ft);
    for (const [itemId, d] of Object.entries(v.items)) push("creature", v.id, "", "sells", { json: { item: Number(itemId), price: d.p ?? null, stack: d.st ?? null, limited: d.lim ?? null, ec: d.ec ?? null } }, v.ft);
  }
  for (const n of Object.values(w.taxiNodes)) {
    if (n.name) push("taxi_node", n.id, "", "name", { text: n.name }, n.ft, undefined, "client_catalog");
    if (n.m !== undefined && n.x !== undefined) push("taxi_node", n.id, "", "position", { json: { k: "catalog" } }, n.ft, { t: n.ft, m: n.m, x: n.x, y: n.y }, "client_catalog");
    if (n.faction !== undefined) push("taxi_node", n.id, "", "faction", { num: n.faction }, n.ft, undefined, "client_catalog");
    if (n.fm !== undefined) push("taxi_node", n.id, "", "flight_master", { num: n.fm }, n.ft);
    for (const to of Object.keys(n.routes ?? {})) push("taxi_node", n.id, "", "taxi_route", { json: { to: Number(to) } }, n.ft);
  }
  return rows;
}

type Push = (entityType: string, entityId: number, entityKey: string, field: string, value: { num?: number; text?: string; json?: unknown; bool?: boolean }, t: number, pos?: Position, source?: "encounter" | "client_catalog") => void;

function creatureObservations(cr: CreatureRecord, push: Push): void {
  // Add-ons before 0.2.1 sent player pets. They are never wiki data (D-0038, N-0019).
  if (cr.gt === "Pet") return;
  const id = cr.id;
  const t = cr.ft;
  if (cr.name) push("creature", id, "", "name", { text: cr.name }, t);
  push("creature", id, "", "guid_type", { text: cr.gt }, t);
  if (cr.lmin !== undefined) push("creature", id, "", "level_min", { num: cr.lmin }, t);
  if (cr.lmax !== undefined) push("creature", id, "", "level_max", { num: cr.lmax }, t);
  if (cr.cls) push("creature", id, "", "classification", { text: cr.cls }, t);
  if (cr.ct) push("creature", id, "", "creature_type", { text: cr.ct }, t);
  if (cr.cf) push("creature", id, "", "creature_family", { text: cr.cf }, t);
  if (cr.rx !== undefined) push("creature", id, "", "reaction", { json: { reaction: cr.rx } }, t);
  if (cr.fg) push("creature", id, "", "faction_group", { text: cr.fg }, t);
  if (cr.pvp !== undefined) push("creature", id, "", "pvp", { bool: cr.pvp }, t);
  if (cr.civ !== undefined) push("creature", id, "", "civilian", { bool: cr.civ }, t);
  if (cr.atk !== undefined) push("creature", id, "", "attackable", { bool: cr.atk }, t);
  if (cr.sex !== undefined) push("creature", id, "", "sex", { num: cr.sex }, t);
  if (cr.pt !== undefined) push("creature", id, "", "power_type", { num: cr.pt }, t);
  if (cr.sub) push("creature", id, "", "subtitle", { text: cr.sub }, t);
  if (cr.tf) push("creature", id, "", "tooltip_faction", { text: cr.tf }, t);
  for (const [lvl, hp] of Object.entries(cr.hp ?? {})) push("creature", id, "", "health", { json: { level: Number(lvl), max: hp } }, t);
  for (const [lvl, pw] of Object.entries(cr.pw ?? {})) push("creature", id, "", "power", { json: { level: Number(lvl), max: pw } }, t);
  for (const role of Object.keys(cr.roles ?? {})) push("creature", id, "", `role:${role}`, { bool: true }, t);
  if (cr.di !== undefined) push("creature", id, "", "display_id", { num: cr.di }, t, undefined, "client_catalog");
  if (cr.tl?.length) {
    push("creature", id, "", "tooltip_extra", { json: cr.tl }, t);
    // Beast Lore (D-0049): "Tameable", "Diet: Meat, Fish", then pet skills with ranks.
    const lore = beastLore(cr.tl);
    if (lore.tameable) push("creature", id, "", "tameable", { bool: true }, t);
    if (lore.diet) push("creature", id, "", "diet", { text: lore.diet }, t);
    for (const sk of lore.skills) push("creature", id, "", "pet_skill", { json: sk }, t);
  }
  for (const p of cr.pos ?? []) push("creature", id, "", "position", { json: { k: p.k ?? "target" } }, p.t, p);
}

/** What Beast Lore adds to a beast's tooltip, in the client's own words. */
export function beastLore(lines: string[]): { tameable: boolean; diet: string | null; skills: Array<{ name: string; rank: number | null }> } {
  const out = { tameable: false, diet: null as string | null, skills: [] as Array<{ name: string; rank: number | null }> };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^tameable$/i.test(line)) out.tameable = true;
    else if (/^diet:\s*/i.test(line)) out.diet = line.replace(/^diet:\s*/i, "");
    else {
      const m = /^(.+?)\s*\(Rank\s+(\d+)\)$/i.exec(line);
      if (m && out.tameable) out.skills.push({ name: m[1]!, rank: Number(m[2]) });
    }
  }
  return out;
}

function questObservations(q: QuestRecord, push: Push): void {
  const id = q.id, t = q.ft;
  if (q.title) push("quest", id, "", "name", { text: q.title }, t);
  if (q.lvl !== undefined) push("quest", id, "", "level", { num: q.lvl }, t);
  if (q.grp !== undefined) push("quest", id, "", "suggested_group", { num: q.grp }, t);
  if (q.hdr) push("quest", id, "", "log_header", { text: q.hdr }, t);
  if (q.freq !== undefined) push("quest", id, "", "frequency", { num: q.freq }, t);
  if (q.desc) push("quest", id, "", "description", { text: q.desc }, t);
  if (q.obj) push("quest", id, "", "objectives_text", { text: q.obj }, t);
  if (q.prog) push("quest", id, "", "progress_text", { text: q.prog }, t);
  if (q.done) push("quest", id, "", "completion_text", { text: q.done }, t);
  for (const o of q.objs ?? []) push("quest", id, "", "objective", { json: { text: o.t, type: o.type ?? null, n: o.n ?? null } }, t);
  if (q.xp !== undefined) push("quest", id, "", "reward_xp", { num: q.xp }, t);
  if (q.money !== undefined) push("quest", id, "", "reward_money", { num: q.money }, t);
  if (q.reqMoney !== undefined) push("quest", id, "", "required_money", { num: q.reqMoney }, t);
  // Relation inputs: who starts and ends it (on the creature), what it rewards and needs (on the quest).
  if (q.giver?.k === "c" && q.giver.id !== undefined) push("creature", q.giver.id, "", "starts", { json: { quest: id } }, t);
  if (q.giver?.k === "i") push("quest", id, "", "item_started", { bool: true }, t);
  if (q.ender?.k === "c" && q.ender.id !== undefined) push("creature", q.ender.id, "", "ends", { json: { quest: id } }, t);
  for (const r of q.rw ?? []) push("quest", id, "", "rewards", { json: { item: r.i, n: r.n ?? 1, choice: false } }, t);
  for (const r of q.ch ?? []) push("quest", id, "", "rewards", { json: { item: r.i, n: r.n ?? 1, choice: true } }, t);
  for (const r of q.req ?? []) push("quest", id, "", "requires", { json: { item: r.i, n: r.n ?? 1 } }, t);
  for (const p of q.pos ?? []) push("quest", id, "", "position", { json: { k: "giver" } }, p.t, p);
}

function itemObservations(it: ItemRecord, push: Push): void {
  const id = it.id, t = it.ft;
  if (it.name) push("item", id, "", "name", { text: it.name }, t);
  if (it.q !== undefined) push("item", id, "", "quality", { num: it.q }, t);
  if (it.il !== undefined) push("item", id, "", "item_level", { num: it.il }, t);
  if (it.rl !== undefined) push("item", id, "", "required_level", { num: it.rl }, t);
  if (it.cls) push("item", id, "", "class", { text: it.cls }, t);
  if (it.sub) push("item", id, "", "subclass", { text: it.sub }, t);
  if (it.cid !== undefined) push("item", id, "", "class_id", { num: it.cid }, t);
  if (it.sid !== undefined) push("item", id, "", "subclass_id", { num: it.sid }, t);
  if (it.st !== undefined) push("item", id, "", "max_stack", { num: it.st }, t);
  if (it.eq) push("item", id, "", "equip_loc", { text: it.eq }, t);
  if (it.ic !== undefined) push("item", id, "", "icon", { num: it.ic }, t, undefined, "client_catalog");
  if (it.sp !== undefined) push("item", id, "", "sell_price", { num: it.sp }, t);
  if (it.bt !== undefined) push("item", id, "", "bind_type", { num: it.bt }, t);
  if (it.xp !== undefined) push("item", id, "", "expansion", { num: it.xp }, t);
  if (it.set !== undefined) push("item", id, "", "set", { num: it.set }, t);
  if (it.rg) push("item", id, "", "reagent", { bool: true }, t);
  if (it.tip?.length) push("item", id, "", "tooltip", { json: it.tip }, t);
}

async function writeJournal(db: SupabaseClient, characterId: string, sessionId: string, s: Session): Promise<void> {
  type EventRow = { character_id: string; session_id: string; kind: string; at: string; map_id: number | null; pos_x: number | null; pos_y: number | null; instance_id: number | null; world_x: number | null; world_y: number | null; payload: Record<string, unknown> };
  const events: EventRow[] = s.events.map((e) => ({
    character_id: characterId,
    session_id: sessionId,
    kind: e.k,
    at: iso(e.t),
    map_id: e.m ?? null,
    pos_x: e.x ?? null,
    pos_y: e.y ?? null,
    instance_id: e.i ?? null,
    world_x: e.wx ?? null,
    world_y: e.wy ?? null,
    payload: e.d ?? {},
  }));

  // First sightings: creatures, areas, maps, instances.
  const sightings: Array<{ type: string; id: number; at: number; name?: string }> = [];
  for (const c of Object.values(s.world.creatures)) sightings.push({ type: "creature", id: c.id, at: c.ft, name: c.name });
  for (const a of Object.values(s.world.areas)) sightings.push({ type: "area", id: a.id, at: a.ft, name: a.name });
  for (const m of Object.values(s.world.maps)) sightings.push({ type: "map", id: m.id, at: m.ft, name: m.name });
  for (const i of Object.values(s.world.instances)) sightings.push({ type: "instance", id: i.id, at: i.ft, name: i.name });
  for (const it of Object.values(s.world.items)) sightings.push({ type: "item", id: it.id, at: it.ft, name: it.name });
  for (const q of Object.values(s.world.quests)) sightings.push({ type: "quest", id: q.id, at: q.ft, name: q.title });
  for (const sg of sightings) {
    const { data: existing } = await db
      .from("character_sightings")
      .select("count, first_at")
      .eq("character_id", characterId)
      .eq("entity_type", sg.type)
      .eq("entity_id", sg.id)
      .maybeSingle();
    if (existing) {
      await db
        .from("character_sightings")
        .update({ count: existing.count + 1, last_at: iso(sg.at), first_at: iso(sg.at) < existing.first_at ? iso(sg.at) : existing.first_at })
        .eq("character_id", characterId)
        .eq("entity_type", sg.type)
        .eq("entity_id", sg.id);
    } else {
      await db.from("character_sightings").insert({ character_id: characterId, entity_type: sg.type, entity_id: sg.id, first_at: iso(sg.at), last_at: iso(sg.at), count: 1, first_session_id: sessionId });
      events.push({ character_id: characterId, session_id: sessionId, kind: "first_sighting", at: iso(sg.at), map_id: null, pos_x: null, pos_y: null, instance_id: null, world_x: null, world_y: null, payload: { entity_type: sg.type, entity_id: sg.id, name: sg.name ?? null } });
    }
  }
  if (events.length) {
    const { error } = await db.from("journal_events").insert(events);
    if (error) throw new Error(`journal insert failed: ${error.message}`);
  }

  // State and stats.
  const st = s.state;
  const asOf = iso(s.ctx.ended ?? s.ctx.started);
  const stats: Array<{ stat_key: string; value_num: number }> = [];
  if (st.level !== undefined) stats.push({ stat_key: "level", value_num: st.level });
  if (s.ctx.hardcore !== undefined) stats.push({ stat_key: "hardcore", value_num: s.ctx.hardcore ? 1 : 0 });
  if (st.playedTotal !== undefined) stats.push({ stat_key: "played_total", value_num: st.playedTotal });
  if (st.playedLevel !== undefined) stats.push({ stat_key: "played_level", value_num: st.playedLevel });
  if (st.money !== undefined) stats.push({ stat_key: "money", value_num: st.money });
  if (stats.length) {
    await db.from("character_stats").upsert(stats.map((x) => ({ character_id: characterId, ...x, updated_at: asOf })), { onConflict: "character_id,stat_key" });
  }
  if (st.level !== undefined) await db.from("characters").update({ level: st.level }).eq("id", characterId);
  const known = Object.values(s.world.taxiNodes).filter((n) => n.known || n.undiscovered === false);
  if (known.length) {
    await db.from("character_state").upsert(
      known.map((n) => ({ character_id: characterId, kind: "taxi", key: String(n.id), value_json: { name: n.name ?? null, map: n.m ?? null }, as_of: asOf })),
      { onConflict: "character_id,kind,key" },
    );
  }
  if (st.quests?.length) {
    const titles = new Map(Object.values(s.world.quests).map((q) => [q.id, q.title ?? null]));
    const doneAt = new Map<number, string>();
    for (const e of s.events) if (e.k === "quest_complete" && typeof e.d?.id === "number") doneAt.set(e.d.id, iso(e.t));
    const rows = [...new Set(st.quests)].map((qid) => ({ character_id: characterId, kind: "quest", key: String(qid), value_json: { title: titles.get(qid) ?? null, at: doneAt.get(qid) ?? null }, as_of: asOf }));
    for (let i = 0; i < rows.length; i += 500) await db.from("character_state").upsert(rows.slice(i, i + 500), { onConflict: "character_id,kind,key", ignoreDuplicates: true });
  }
  const petRows: Array<{ character_id: string; kind: string; key: string; value_json: unknown; as_of: string }> = [];
  if (st.pet) petRows.push({ character_id: characterId, kind: "pet", key: String(st.pet.id), value_json: { name: st.pet.name ?? null, family: st.pet.fam ?? null, level: st.pet.lvl ?? null, skills: st.pet.sk ?? [], active: true }, as_of: asOf });
  for (const sp of st.stable ?? []) petRows.push({ character_id: characterId, kind: "pet", key: `stable:${sp.name}`, value_json: { name: sp.name, family: sp.fam ?? null, level: sp.lvl ?? null, skills: [], active: false }, as_of: asOf });
  if (petRows.length) await db.from("character_state").upsert(petRows, { onConflict: "character_id,kind,key" });
  if (st.explored?.length) {
    await db.from("character_state").upsert(
      st.explored.map((areaId) => ({ character_id: characterId, kind: "explored", key: String(areaId), value_json: true, as_of: asOf })),
      { onConflict: "character_id,kind,key", ignoreDuplicates: true },
    );
  }
  // Counters that accumulate across sessions.
  const deaths = s.events.filter((e) => e.k === "death").length;
  const discoveries = s.events.filter((e) => e.k === "area_discovered").length;
  for (const [key, delta] of [["deaths", deaths], ["areas_discovered", discoveries], ["sessions", 1]] as const) {
    if (!delta) continue;
    const { data: cur } = await db.from("character_stats").select("value_num").eq("character_id", characterId).eq("stat_key", key).maybeSingle();
    await db.from("character_stats").upsert({ character_id: characterId, stat_key: key, value_num: Number(cur?.value_num ?? 0) + delta, updated_at: asOf }, { onConflict: "character_id,stat_key" });
  }
}
