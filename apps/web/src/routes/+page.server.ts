import type { PageServerLoad } from "./$types";
import { wikiCounts } from "$lib/server/db/wiki";

export const load: PageServerLoad = async () => {
  return { counts: await wikiCounts() };
};
