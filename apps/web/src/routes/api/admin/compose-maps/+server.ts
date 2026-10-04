import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { accountFor } from "$lib/server/db/journal";
import { composeOne, pendingMaps } from "$lib/server/map-art";

/** Compose a few pending zone maps per call; the admin page loops until none remain. */
export const POST: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) throw error(401, "sign in");
  const account = await accountFor(locals.user.id);
  if (!account || !["owner", "admin"].includes(account.role)) throw error(403, "administrators only");
  const flavor = url.searchParams.get("flavor") ?? "era";
  const batch = Math.min(5, Number(url.searchParams.get("batch") ?? 3));
  const pending = await pendingMaps(flavor);
  const done: Array<{ mapId: number; pieces: number }> = [];
  const failed: Array<{ mapId: number; error: string }> = [];
  for (const p of pending.slice(0, batch)) {
    try { done.push(await composeOne(flavor, p)); } catch (e) { failed.push({ mapId: p.mapId, error: String(e) }); }
  }
  return json({ done, failed, remaining: Math.max(0, pending.length - done.length) });
};
