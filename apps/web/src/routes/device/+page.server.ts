import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { createHash, randomBytes } from "node:crypto";
import { serviceClient } from "$lib/server/supabase";
import { MOCK } from "$lib/server/db/mock";

export const load: PageServerLoad = async ({ locals, url }) => {
  const code = (url.searchParams.get("code") ?? "").toUpperCase();
  if (!locals.user) throw redirect(303, `/auth?next=${encodeURIComponent(`/device?code=${code}`)}`);
  if (MOCK) return { code: code || "ABC234", name: "Helper on DESKTOP", state: code ? "pending" : "none" };
  if (!code) return { code: "", name: "", state: "none" };
  const { data } = await serviceClient().from("device_codes").select("name, expires_at, approved_at").eq("code", code).maybeSingle();
  if (!data) return { code, name: "", state: "unknown" };
  if (data.approved_at) return { code, name: data.name, state: "approved" };
  if (new Date(data.expires_at) < new Date()) return { code, name: data.name, state: "expired" };
  return { code, name: data.name, state: "pending" };
};

export const actions: Actions = {
  approve: async ({ request, locals }) => {
    if (!locals.user) return fail(401);
    const code = String((await request.formData()).get("code") ?? "").toUpperCase();
    const db = serviceClient();
    const { data } = await db.from("device_codes").select("name, expires_at, approved_at").eq("code", code).maybeSingle();
    if (!data || data.approved_at || new Date(data.expires_at) < new Date()) return fail(400, { error: "That code is not waiting for approval. Ask the helper for a new one." });
    const token = randomBytes(32).toString("hex");
    const { error: tokErr } = await db.from("device_tokens").insert({ account_id: locals.user.id, token_hash: createHash("sha256").update(token).digest("hex"), name: data.name });
    if (tokErr) return fail(500, { error: tokErr.message });
    await db.from("device_codes").update({ account_id: locals.user.id, approved_at: new Date().toISOString(), token }).eq("code", code);
    return { approved: true };
  },
};
