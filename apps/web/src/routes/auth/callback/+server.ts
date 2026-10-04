import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (code) {
    await locals.supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "email" });
  }
  const fromCookie = cookies.get("auth_next");
  if (fromCookie) cookies.delete("auth_next", { path: "/" });
  const next = url.searchParams.get("next") ?? fromCookie;
  throw redirect(303, next && next.startsWith("/") ? next : "/sync");
};
