import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAccount } from "$lib/server/auth-guard";
import { serviceClient } from "$lib/server/supabase";

/** The account's add-on link token, for the helper to write into the link file. */
export const GET: RequestHandler = async (event) => {
  const accountId = await requireAccount(event);
  const { data } = await serviceClient().from("accounts").select("link_token").eq("id", accountId).single();
  return json({ linkToken: data?.link_token ?? null });
};
