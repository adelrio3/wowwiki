import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { achievementProgress, charactersFor } from "$lib/server/db/journal";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/journal");
  const characters = await charactersFor(locals.user.id);
  const progress = await achievementProgress(characters.map((c) => c.id));
  // Account-wide like Blizzard's: the highest result per achievement across characters.
  const best = new Map<string, number>();
  for (const p of progress) if (p.earned_at) best.set(p.achievement_key, Math.max(best.get(p.achievement_key) ?? 0, p.points));
  const perCharacter = new Map<string, { points: number; earned: number }>();
  for (const p of progress) { const c = perCharacter.get(p.character_id) ?? perCharacter.set(p.character_id, { points: 0, earned: 0 }).get(p.character_id)!; if (p.earned_at) { c.points += p.points; c.earned += 1; } }
  return { characters: characters.map((c) => ({ ...c, achievements: perCharacter.get(c.id) ?? { points: 0, earned: 0 } })), account: { points: [...best.values()].reduce((n, v) => n + v, 0), earned: best.size } };
};
