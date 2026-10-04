import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { accountFor, rotateLinkToken } from "$lib/server/db/journal";
import { serviceClient } from "$lib/server/supabase";
import { MOCK } from "$lib/server/db/mock";

async function devicesFor(accountId: string) {
  if (MOCK) return [{ id: "d1", name: "Helper on DESKTOP", created_at: "2026-10-04T10:00:00.000Z", last_used_at: "2026-10-04T12:00:00.000Z" }];
  const { data } = await serviceClient().from("device_tokens").select("id, name, created_at, last_used_at").eq("account_id", accountId).is("revoked_at", null).order("created_at");
  return data ?? [];
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/account");
  const account = await accountFor(locals.user.id);
  return { account, email: locals.user.email, devices: await devicesFor(locals.user.id) };
};

export const actions: Actions = {
  displayName: async ({ request, locals }) => {
    if (!locals.user) return fail(401);
    const name = String((await request.formData()).get("display_name") ?? "").trim();
    if (name.length < 2 || name.length > 32) return fail(400, { error: "2 to 32 characters" });
    const { error } = await serviceClient().from("accounts").update({ display_name: name }).eq("id", locals.user.id);
    if (error) return fail(400, { error: error.code === "23505" ? "that name is taken" : error.message });
    return { ok: true };
  },
  revokeDevice: async ({ request, locals }) => {
    if (!locals.user) return fail(401);
    const id = String((await request.formData()).get("id") ?? "");
    await serviceClient().from("device_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("account_id", locals.user.id);
    return { revoked: true };
  },
  rotate: async ({ locals }) => {
    if (!locals.user) return fail(401);
    await rotateLinkToken(locals.user.id);
    return { rotated: true };
  },
};
