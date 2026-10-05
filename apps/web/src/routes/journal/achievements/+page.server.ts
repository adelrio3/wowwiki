import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { achievementProgress, charactersFor } from "$lib/server/db/journal";
import { catalogFor } from "@compendium/achievements";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/journal/achievements");
  const flavor = url.searchParams.get("flavor") ?? "era";
  const characters = (await charactersFor(locals.user.id)).filter((c) => c.flavor === flavor);
  const progress = await achievementProgress(characters.map((c) => c.id));
  const catalog = catalogFor(flavor);
  const nameOf = new Map(characters.map((c) => [c.id, c.name]));
  const rows = (catalog?.achievements ?? []).map((a) => {
    const mine = progress.filter((p) => p.achievement_key === a.key);
    const earned = mine.filter((p) => p.earned_at).sort((x, y) => (x.earned_at ?? "").localeCompare(y.earned_at ?? ""))[0];
    const best = mine.sort((x, y) => y.criteria_json.fraction - x.criteria_json.fraction)[0];
    return { key: a.key, name: a.name, description: a.description, category: a.category, points: a.points, feat: a.feat ?? false, original: a.original ?? false, earnedAt: earned?.earned_at ?? null, earnedBy: earned ? (nameOf.get(earned.character_id) ?? null) : null, fraction: best?.criteria_json.fraction ?? 0, bestBy: best ? (nameOf.get(best.character_id) ?? null) : null, criteria: best?.criteria_json.criteria ?? [] };
  });
  const categories = (catalog?.categories ?? []).filter((c) => !c.parent).map((c) => ({ ...c, groups: [{ key: c.key, name: null as string | null, rows: rows.filter((r) => r.category === c.key) }, ...(catalog?.categories ?? []).filter((s) => s.parent === c.key).map((s) => ({ key: s.key, name: s.name as string | null, rows: rows.filter((r) => r.category === s.key) }))].filter((g) => g.rows.length) }));
  return { flavor, version: catalog?.version ?? 0, categories, points: rows.filter((r) => r.earnedAt).reduce((n, r) => n + r.points, 0), earned: rows.filter((r) => r.earnedAt && !r.feat).length, total: rows.filter((r) => !r.feat).length };
};
