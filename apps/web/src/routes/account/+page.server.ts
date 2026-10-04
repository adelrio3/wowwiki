import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { accountFor, rotateLinkToken } from "$lib/server/db/journal";
import { serviceClient } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/account");
  const account = await accountFor(locals.user.id);
  return { account, email: locals.user.email };
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
  rotate: async ({ locals }) => {
    if (!locals.user) return fail(401);
    await rotateLinkToken(locals.user.id);
    return { rotated: true };
  },
};
