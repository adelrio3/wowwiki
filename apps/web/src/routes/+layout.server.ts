import type { LayoutServerLoad } from "./$types";
import { accountFor } from "$lib/server/db/journal";

export const load: LayoutServerLoad = async ({ locals }) => {
  const account = locals.user ? await accountFor(locals.user.id) : null;
  return { session: locals.session, user: locals.user, isAdmin: !!account && ["owner", "admin"].includes(account.role) };
};
