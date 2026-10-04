import { createServerClient } from "@supabase/ssr";
import type { Handle } from "@sveltejs/kit";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "$lib/server/env";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          event.cookies.set(name, value, { ...options, path: "/" });
        }
      },
    },
  });

  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };
    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser();
    if (error || !user) return { session: null, user: null };
    return { session, user };
  };

  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;

  return resolve(event, {
    filterSerializedResponseHeaders: (name) => name === "content-range" || name === "x-supabase-api-version",
  });
};
