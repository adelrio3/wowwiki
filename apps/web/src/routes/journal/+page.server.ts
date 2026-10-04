import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { charactersFor } from "$lib/server/db/journal";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/journal");
  return { characters: await charactersFor(locals.user.id) };
};
