/**
 * Public configuration. The Supabase URL and publishable key are public by
 * design (they only grant what row level security allows) and are committed
 * here so the site works without any environment variable. Environment
 * variables override them, and the secret key is ONLY ever read from the
 * environment (src/lib/server/supabase.ts).
 */
export const PUBLIC_SUPABASE_URL = "https://sitleknaawijqvjgxqwp.supabase.co";
export const PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_8DRMUk-iTlVac7BGhX4baA_MGB8Fymr";
export const SITE_NAME = "WoW Compendium";
export const SITE_URL = "https://wow-wiki.netlify.app";
