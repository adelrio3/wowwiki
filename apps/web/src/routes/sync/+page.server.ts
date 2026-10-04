import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { accountFor, uploadsFor } from "$lib/server/db/journal";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, `/auth?next=${encodeURIComponent(url.pathname)}`);
  const account = await accountFor(locals.user.id);
  return { linkToken: account?.link_token ?? null, uploads: await uploadsFor(locals.user.id) };
};
