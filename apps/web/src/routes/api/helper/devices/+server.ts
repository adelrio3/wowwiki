import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { helpersFor } from "$lib/server/db/helpers";

/** The signed-in user's helpers, for the Add-on page to refresh without reloading. */
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "sign in");
  return json({ helpers: await helpersFor(locals.user.id) });
};
