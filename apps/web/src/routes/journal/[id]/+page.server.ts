import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { achievementProgress, characterDetail } from "$lib/server/db/journal";
import { mapNames } from "$lib/server/db/wiki";
import { catalogFor } from "@compendium/achievements";

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, "/auth?next=/journal");
  const detail = await characterDetail(locals.user.id, params.id);
  if (!detail) throw error(404, "no such character");
  const mapIds = [...new Set([...detail.events.map((e) => e.map_id), ...detail.zonesVisited.map((z) => z.mapId), ...detail.flightPaths.map((f) => f.mapId)].filter((m): m is number => m !== null))];
  const [maps, progress] = await Promise.all([mapNames(detail.character.flavor, mapIds), achievementProgress([detail.character.id])]);
  const catalog = catalogFor(detail.character.flavor);
  const byKey = new Map(progress.map((p) => [p.achievement_key, p]));
  const all = (catalog?.achievements ?? []).map((a) => { const p = byKey.get(a.key); return { key: a.key, name: a.name, description: a.description, points: a.points, feat: a.feat ?? false, earnedAt: p?.earned_at ?? null, fraction: p?.criteria_json.fraction ?? 0, criteria: p?.criteria_json.criteria ?? [] }; });
  const earned = all.filter((a) => a.earnedAt).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""));
  const nextUp = all.filter((a) => !a.earnedAt && !a.feat && a.fraction > 0).sort((a, b) => b.fraction - a.fraction).slice(0, 6);
  return { ...detail, maps, achievements: { points: earned.reduce((n, a) => n + a.points, 0), earned, nextUp, total: all.filter((a) => !a.feat).length } };
};
