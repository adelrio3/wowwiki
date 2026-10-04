import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, serviceRoleKey } from "./env";

let client: SupabaseClient | undefined;

/** Service-role client. Server only. Bypasses row level security: every use must check access itself. */
export function serviceClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
