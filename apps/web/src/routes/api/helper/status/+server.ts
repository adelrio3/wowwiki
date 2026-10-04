import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createHash } from "node:crypto";
import { serviceClient } from "$lib/server/supabase";

/**
 * The helper reports its state (every cycle and as a heartbeat) and collects
 * any action the site asked for. Device-token auth only.
 */
export const POST: RequestHandler = async ({ request }) => {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw error(401, "device token required");
  const hash = createHash("sha256").update(auth.slice(7)).digest("hex");
  const db = serviceClient();
  const { data: dev } = await db.from("device_tokens").select("id, revoked_at, pending_action").eq("token_hash", hash).maybeSingle();
  if (!dev || dev.revoked_at) throw error(401, "device token revoked");
  const body = (await request.json().catch(() => ({}))) as { helperVersion?: string; state?: Record<string, unknown> };
  const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (body.helperVersion) update.helper_version = String(body.helperVersion).slice(0, 20);
  if (body.state && typeof body.state === "object") update.state = body.state;
  if (dev.pending_action) update.pending_action = null;
  await db.from("device_tokens").update(update).eq("id", dev.id);
  return json({ pendingAction: dev.pending_action ?? null });
};
