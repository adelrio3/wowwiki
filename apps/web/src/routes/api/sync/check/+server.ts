import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SyncCheckRequestSchema } from "@compendium/schema";
import { requireAccount } from "$lib/server/auth-guard";
import { serviceClient } from "$lib/server/supabase";

export const POST: RequestHandler = async (event) => {
  const accountId = await requireAccount(event);
  const body = SyncCheckRequestSchema.parse(await event.request.json());
  const { data } = await serviceClient().from("uploads").select("id, sha256, ingest_status, account_id").in("sha256", body.hashes);
  const known: Record<string, { uploadId: string; status: string }> = {};
  for (const row of data ?? []) {
    // A file hash is global; only the owning account learns its status.
    if (row.account_id === accountId) known[row.sha256] = { uploadId: row.id, status: row.ingest_status };
  }
  return json({ missing: body.hashes.filter((h) => !known[h]), known });
};
