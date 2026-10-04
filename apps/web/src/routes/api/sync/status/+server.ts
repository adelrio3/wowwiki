import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAccount } from "$lib/server/auth-guard";
import { serviceClient } from "$lib/server/supabase";
import { currentAck, ingestUpload } from "$lib/server/ingest";

export const GET: RequestHandler = async (event) => {
  const accountId = await requireAccount(event);
  const uploadId = event.url.searchParams.get("uploadId");
  if (!uploadId) throw error(400, "uploadId required");
  const db = serviceClient();
  const { data: row } = await db.from("uploads").select("id, account_id, ingest_status, ingest_error, observation_count, received_at").eq("id", uploadId).maybeSingle();
  if (!row || row.account_id !== accountId) throw error(404, "no such upload");

  // Resume an ingest that never finished (function timeout or crash).
  if (row.ingest_status === "received" || (row.ingest_status === "ingesting" && Date.now() - new Date(row.received_at).getTime() > 5 * 60_000)) {
    const result = await ingestUpload(uploadId);
    return json({ uploadId, status: result.status, error: result.error ?? null, observations: result.observations, ack: result.ack });
  }
  return json({
    uploadId,
    status: row.ingest_status,
    error: row.ingest_error,
    observations: row.observation_count ?? undefined,
    ack: row.ingest_status === "ingested" ? await currentAck(db, accountId) : {},
  });
};
