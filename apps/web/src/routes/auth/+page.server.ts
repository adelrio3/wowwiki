import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    if (!email) return fail(400, { error: "email required" });
    const { error } = await locals.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback` },
    });
    if (error) return fail(400, { error: error.message });
    return { sent: true };
  },
};
