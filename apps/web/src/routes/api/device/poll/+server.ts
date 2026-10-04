import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serviceClient } from "$lib/server/supabase";

/** The helper polls until the user approves. The token is handed over exactly once. */
export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code ?? "").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw error(400, "bad code");
  const db = serviceClient();
  const { data } = await db.from("device_codes").select("expires_at, approved_at, token, claimed_at").eq("code", code).maybeSingle();
  if (!data) return json({ status: "unknown" });
  if (data.claimed_at) return json({ status: "claimed" });
  if (new Date(data.expires_at) < new Date()) return json({ status: "expired" });
  if (!data.approved_at || !data.token) return json({ status: "pending" });
  await db.from("device_codes").update({ token: null, claimed_at: new Date().toISOString() }).eq("code", code);
  return json({ status: "approved", token: data.token });
};
