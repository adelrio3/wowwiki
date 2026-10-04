import { env } from "$env/dynamic/private";
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "$lib/config";

export const SUPABASE_URL = env.SUPABASE_URL || PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON_KEY;

export function serviceRoleKey(): string {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}
