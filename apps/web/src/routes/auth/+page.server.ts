import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  /** Password sign-in: for accounts that set one (the owner, when the email service is rate-limited). */
  password: async ({ request, locals, url }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return fail(400, { perror: "email and password required" });
    const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(400, { perror: error.message });
    const next = url.searchParams.get("next");
    throw redirect(303, next && next.startsWith("/") ? next : "/sync");
  },
  link: async ({ request, locals, url, cookies }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    if (!email) return fail(400, { error: "email required" });
    const next = url.searchParams.get("next");
    if (next && next.startsWith("/")) cookies.set("auth_next", next, { path: "/", maxAge: 3600, httpOnly: true, sameSite: "lax" });
    const { error } = await locals.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback` },
    });
    if (error) return fail(400, { error: error.message });
    return { sent: true };
  },
};
