import { error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { createHash } from "node:crypto";
import { serviceClient } from "./supabase";

/** Resolve the account for an API call: session cookie, or a helper device token. */
export async function requireAccount(event: RequestEvent): Promise<string> {
  if (event.locals.user) return event.locals.user.id;
  const auth = event.request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const hash = createHash("sha256").update(auth.slice(7)).digest("hex");
    const { data } = await serviceClient().from("device_tokens").select("account_id, revoked_at").eq("token_hash", hash).maybeSingle();
    if (data && !data.revoked_at) {
      await serviceClient().from("device_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
      return data.account_id;
    }
  }
  throw error(401, "sign in to sync");
}
