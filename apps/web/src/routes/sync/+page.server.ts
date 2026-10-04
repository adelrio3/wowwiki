import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { accountFor, uploadsFor } from "$lib/server/db/journal";
import { helpersFor, requestHelperAction } from "$lib/server/db/helpers";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, `/auth?next=${encodeURIComponent(url.pathname)}`);
  const [account, uploads, helpers] = await Promise.all([accountFor(locals.user.id), uploadsFor(locals.user.id), helpersFor(locals.user.id)]);
  return { linkToken: account?.link_token ?? null, uploads, helpers };
};

export const actions: Actions = {
  /** Ask a helper to run a cycle now: it installs or updates the add-on if needed, then syncs. */
  helperSync: async ({ request, locals }) => {
    if (!locals.user) return fail(401);
    const id = String((await request.formData()).get("device") ?? "");
    if (!id) return fail(400);
    await requestHelperAction(locals.user.id, id, "sync");
    return { requested: id };
  },
};
