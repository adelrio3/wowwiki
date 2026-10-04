/**
 * L1 → L2 aggregation: facts, positions. Status rules per docs/02 and
 * docs/05 (threshold 2, trusted accounts count double, 80% supermajority).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export interface EntityRef {
  flavor: string;
  entityType: string;
  entityId: number;
  entityKey: string;
}

const CONFIRM_THRESHOLD = 2;
const SUPERMAJORITY = 0.8;
const CLUSTER_RADIUS = 0.02; // map fraction

export type Obs = {
  account_id: string | null;
  build: number;
  locale: string;
  server_time: string;
  field: string;
  value_kind: string;
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  map_id: number | null;
  pos_x: number | null;
  pos_y: number | null;
  instance_id: number | null;
  world_x: number | null;
  world_y: number | null;
  source: string;
  tombstoned: boolean;
};

function valueHash(o: Obs): string {
  const payload = o.value_kind === "text" ? o.value_text : o.value_kind === "json" ? JSON.stringify(o.value_json) : String(o.value_num);
  return createHash("sha1").update(`${o.value_kind}:${payload}`).digest("hex");
}

export async function aggregateEntities(db: SupabaseClient, refs: EntityRef[]): Promise<void> {
  const trusted = await trustedAccounts(db);
  for (const ref of refs) await aggregateOne(db, ref, trusted);
}

async function trustedAccounts(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db.from("accounts").select("id").eq("trusted", true);
  return new Set((data ?? []).map((r) => r.id));
}

export async function aggregateOne(db: SupabaseClient, ref: EntityRef, trusted: Set<string>): Promise<void> {
  const { data, error } = await db
    .from("observations")
    .select("account_id, build, locale, server_time, field, value_kind, value_num, value_text, value_json, map_id, pos_x, pos_y, instance_id, world_x, world_y, source, tombstoned")
    .eq("flavor", ref.flavor)
    .eq("entity_type", ref.entityType)
    .eq("entity_id", ref.entityId)
    .eq("entity_key", ref.entityKey)
    .limit(20000);
  if (error) throw new Error(`aggregate read failed: ${error.message}`);
  const obs = ((data ?? []) as Obs[]).filter((o) => !o.tombstoned);

  const rows = computeFacts(ref, obs, trusted);
  if (rows.length) {
    const { error: upErr } = await db.from("facts").upsert(rows, { onConflict: "flavor,entity_type,entity_id,entity_key,field,locale,value_hash" });
    if (upErr) throw new Error(`facts upsert failed: ${upErr.message}`);
  }

  const clusters = computePositions(obs);
  await db.from("positions").delete().eq("flavor", ref.flavor).eq("entity_type", ref.entityType).eq("entity_id", ref.entityId);
  if (clusters.length && ref.entityId !== 0) {
    const { error: posErr } = await db.from("positions").insert(
      clusters.map((c) => ({
        flavor: ref.flavor,
        entity_type: ref.entityType,
        entity_id: ref.entityId,
        map_id: c.map,
        cluster_x: c.x,
        cluster_y: c.y,
        instance_id: c.inst,
        world_x: c.wn ? c.wx : null,
        world_y: c.wn ? c.wy : null,
        radius: CLUSTER_RADIUS,
        observation_count: c.n,
        contributor_count: c.accounts.size,
        first_build: c.firstBuild,
        last_build: c.lastBuild,
        updated_at: new Date().toISOString(),
      })),
    );
    if (posErr) throw new Error(`positions insert failed: ${posErr.message}`);
  }
}

export interface FactRowOut {
  flavor: string;
  entity_type: string;
  entity_id: number;
  entity_key: string;
  field: string;
  locale: string;
  value_hash: string;
  value_kind: string;
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  first_build: number;
  last_build: number;
  first_seen_at: string;
  last_seen_at: string;
  contributor_count: number;
  observation_count: number;
  pending_count: number;
  status: "unconfirmed" | "confirmed" | "disputed";
  source: string;
  updated_at: string;
}

/** Pure: observations of one entity → fact rows with status (docs/02, docs/05). */
export function computeFacts(ref: EntityRef, obs: Obs[], trusted: Set<string>): FactRowOut[] {
  const weight = (accountId: string | null) => (accountId && trusted.has(accountId) ? 2 : 1);

  type Value = { sample: Obs; accounts: Set<string>; anon: number; count: number; firstBuild: number; lastBuild: number; firstAt: string; lastAt: string; source: string };
  type Group = { field: string; locale: string; values: Map<string, Value> };
  const groups = new Map<string, Group>();
  for (const o of obs) {
    if (o.field === "position") continue;
    const locale = o.value_kind === "text" ? o.locale : "";
    const gk = `${o.field}|${locale}`;
    let g = groups.get(gk);
    if (!g) {
      g = { field: o.field, locale, values: new Map() };
      groups.set(gk, g);
    }
    const vh = valueHash(o);
    let v = g.values.get(vh);
    if (!v) {
      v = { sample: o, accounts: new Set(), anon: 0, count: 0, firstBuild: o.build, lastBuild: o.build, firstAt: o.server_time, lastAt: o.server_time, source: o.source };
      g.values.set(vh, v);
    }
    v.count++;
    if (o.account_id) v.accounts.add(o.account_id);
    else v.anon++;
    v.firstBuild = Math.min(v.firstBuild, o.build);
    v.lastBuild = Math.max(v.lastBuild, o.build);
    if (o.server_time < v.firstAt) v.firstAt = o.server_time;
    if (o.server_time > v.lastAt) v.lastAt = o.server_time;
  }

  const now = new Date().toISOString();
  const rows: FactRowOut[] = [];
  for (const g of groups.values()) {
    const contributorsOf = (accounts: Set<string>) => [...accounts].reduce((n, a) => n + weight(a), 0);
    const total = [...g.values.values()].reduce((n, v) => n + contributorsOf(v.accounts), 0);
    // Multi-valued fields (health by level, roles, reaction) are sets, not disputes.
    // Observer-relative fields (reaction, attackable, civilian) legitimately differ by faction.
    const multiValued = g.field === "health" || g.field === "power" || g.field.startsWith("role:") || g.field === "reaction" || g.field === "attackable" || g.field === "civilian";
    for (const [vh, v] of g.values) {
      const contributors = contributorsOf(v.accounts);
      let status: FactRowOut["status"] = contributors >= CONFIRM_THRESHOLD ? "confirmed" : "unconfirmed";
      if (!multiValued && g.values.size > 1 && total > 0 && contributors / total < SUPERMAJORITY) {
        status = contributors >= CONFIRM_THRESHOLD ? "disputed" : "unconfirmed";
      }
      rows.push({
        flavor: ref.flavor,
        entity_type: ref.entityType,
        entity_id: ref.entityId,
        entity_key: ref.entityKey,
        field: g.field,
        locale: g.locale,
        value_hash: vh,
        value_kind: v.sample.value_kind,
        value_num: v.sample.value_num,
        value_text: v.sample.value_text,
        value_json: v.sample.value_json,
        first_build: v.firstBuild,
        last_build: v.lastBuild,
        first_seen_at: v.firstAt,
        last_seen_at: v.lastAt,
        contributor_count: v.accounts.size,
        observation_count: v.count,
        pending_count: v.anon,
        status,
        source: v.source,
        updated_at: now,
      });
    }
  }
  return rows;
}

/** Pure: position observations → clusters per map by a simple greedy radius. */
export type Cluster = { map: number; x: number; y: number; n: number; accounts: Set<string>; inst: number | null; wx: number; wy: number; wn: number; firstBuild: number; lastBuild: number };
export function computePositions(obs: Obs[]): Cluster[] {
  const posObs = obs.filter((o) => o.field === "position" && o.map_id !== null && o.pos_x !== null && o.pos_y !== null);
  const clusters: Cluster[] = [];
  for (const o of posObs) {
    const x = o.pos_x!, y = o.pos_y!;
    let c = clusters.find((cl) => cl.map === o.map_id && Math.hypot(cl.x - x, cl.y - y) <= CLUSTER_RADIUS);
    if (!c) {
      c = { map: o.map_id!, x, y, n: 0, accounts: new Set(), inst: o.instance_id, wx: 0, wy: 0, wn: 0, firstBuild: o.build, lastBuild: o.build };
      clusters.push(c);
    }
    c.x = (c.x * c.n + x) / (c.n + 1);
    c.y = (c.y * c.n + y) / (c.n + 1);
    c.n++;
    if (o.account_id) c.accounts.add(o.account_id);
    if (o.world_x !== null && o.world_y !== null) {
      c.wx = (c.wx * c.wn + o.world_x) / (c.wn + 1);
      c.wy = (c.wy * c.wn + o.world_y) / (c.wn + 1);
      c.wn++;
    }
    c.firstBuild = Math.min(c.firstBuild, o.build);
    c.lastBuild = Math.max(c.lastBuild, o.build);
  }
  return clusters;
}
