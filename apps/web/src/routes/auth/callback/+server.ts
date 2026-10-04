import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (code) {
    await locals.supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "email" });
  }
  throw redirect(303, url.searchParams.get("next") ?? "/sync");
};
