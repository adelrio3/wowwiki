import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SyncUploadMetaSchema } from "@compendium/schema";
import { requireAccount } from "$lib/server/auth-guard";
import { serviceClient } from "$lib/server/supabase";
import { ingestUpload } from "$lib/server/ingest";

const MAX_BYTES = 25 * 1024 * 1024;

export const POST: RequestHandler = async (event) => {
  const accountId = await requireAccount(event);
  const form = await event.request.formData();
  const metaRaw = form.get("meta");
  const file = form.get("file");
  if (typeof metaRaw !== "string" || !(file instanceof Blob)) throw error(400, "meta and file are required");
  const meta = SyncUploadMetaSchema.parse(JSON.parse(metaRaw));
  if (file.size > MAX_BYTES) throw error(413, "file too large");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const db = serviceClient();
  const { data: account } = await db.from("accounts").select("link_token").eq("id", accountId).single();
  if (meta.accountToken && account && meta.accountToken !== account.link_token) {
    throw error(409, "this add-on is linked to a different account; relink it from the sync page");
  }

  const hash = await sha256(bytes);
  if (hash !== meta.sha256) throw error(400, "hash mismatch");

  const { data: existing } = await db.from("uploads").select("id, ingest_status, account_id").eq("sha256", hash).maybeSingle();
  if (existing) {
    if (existing.account_id !== accountId) throw error(409, "this file was uploaded by another account");
    return json({ uploadId: existing.id, status: existing.ingest_status === "ingested" ? "duplicate" : existing.ingest_status });
  }

  const storagePath = `${accountId}/${hash}.lua`;
  const { error: upErr } = await db.storage.from("uploads").upload(storagePath, bytes, { contentType: "text/x-lua", upsert: true });
  if (upErr) throw error(500, `storage: ${upErr.message}`);

  const { data: row, error: insErr } = await db
    .from("uploads")
    .insert({
      account_id: accountId,
      addon_identity: await ensureIdentity(meta.identity, accountId, meta.flavor),
      flavor: meta.flavor,
      flavor_folder: meta.flavorFolder,
      storage_path: storagePath,
      sha256: hash,
      byte_size: bytes.byteLength,
      schema_version: meta.summary.schema,
      addon_version: meta.summary.addonVersion,
    })
    .select("id")
    .single();
  if (insErr || !row) throw error(500, `upload row: ${insErr?.message}`);

  // Ingest inline (N-0011): small files finish well within the function's
  // time budget; a timeout leaves the row at "received", and the status
  // endpoint resumes it.
  const result = await ingestUpload(row.id);
  return json({ uploadId: row.id, status: result.status === "ingested" ? "ingested" : "failed" });
};

async function ensureIdentity(id: string, accountId: string, flavor: string): Promise<string> {
  const db = serviceClient();
  const { data } = await db.from("addon_identities").select("id, account_id").eq("id", id).maybeSingle();
  if (!data) {
    await db.from("addon_identities").insert({ id, account_id: accountId, flavor });
  } else if (data.account_id && data.account_id !== accountId) {
    await db.from("addon_identities").update({ held_for_review: true }).eq("id", id);
    throw error(409, "this add-on install belongs to another account");
  }
  return id;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
