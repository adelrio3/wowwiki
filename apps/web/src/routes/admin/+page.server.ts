import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { accountFor } from "$lib/server/db/journal";
import { locatorFor, pendingMaps } from "$lib/server/map-art";
import { MOCK } from "$lib/server/db/mock";
import { serviceClient } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/admin");
  const account = await accountFor(locals.user.id);
  if (!account || !["owner", "admin"].includes(account.role)) throw error(403, "administrators only");
  const locator = locatorFor("era");
  if (MOCK) return { pending: 2, composed: 1, locator: locator ? { build: locator.build, files: Object.keys(locator.files).length } : null };
  const [pending, { count }] = await Promise.all([pendingMaps("era"), serviceClient().from("artwork").select("id", { count: "exact", head: true }).eq("kind", "map")]);
  return { pending: pending.length, composed: count ?? 0, locator: locator ? { build: locator.build, files: Object.keys(locator.files).length } : null };
};
