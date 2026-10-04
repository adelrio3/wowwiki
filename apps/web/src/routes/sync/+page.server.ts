import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { accountFor, uploadsFor } from "$lib/server/db/journal";
import { helpersFor, isHelperAction, requestHelperAction } from "$lib/server/db/helpers";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, `/auth?next=${encodeURIComponent(url.pathname)}`);
  const [account, uploads, helpers] = await Promise.all([accountFor(locals.user.id), uploadsFor(locals.user.id), helpersFor(locals.user.id)]);
  return { linkToken: account?.link_token ?? null, uploads, helpers };
};

export const actions: Actions = {
  /** Ask a helper to act: the same actions its own window offers (D-0043). */
  helper: async ({ request, locals }) => {
    if (!locals.user) return fail(401);
    const form = await request.formData();
    const id = String(form.get("device") ?? "");
    const action = String(form.get("action") ?? "");
    if (!id || !isHelperAction(action)) return fail(400);
    await requestHelperAction(locals.user.id, id, action);
    return { requested: id, action };
  },
};
