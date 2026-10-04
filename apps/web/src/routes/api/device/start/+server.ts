import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { randomInt } from "node:crypto";
import { serviceClient } from "$lib/server/supabase";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

/** The helper asks for a sign-in code. Anyone may call; the code is useless until a signed-in user approves it. */
export const POST: RequestHandler = async ({ request, url }) => {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = String(body.name ?? "Helper").slice(0, 60);
  const db = serviceClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const { error: insErr } = await db.from("device_codes").insert({ code, name });
    if (!insErr) return json({ code, verifyUrl: `${url.origin}/device?code=${code}`, expiresInSeconds: 600, pollSeconds: 3 });
    if (insErr.code !== "23505") throw error(500, insErr.message);
  }
  throw error(500, "could not make a code");
};
