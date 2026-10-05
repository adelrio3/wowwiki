import type { PageServerLoad } from "./$types";
import { hunterBeasts } from "$lib/server/db/wiki";

export const load: PageServerLoad = async ({ url }) => {
  const flavor = url.searchParams.get("flavor") ?? "era";
  const family = url.searchParams.get("family") ?? "";
  const beasts = await hunterBeasts(flavor);
  const families = [...new Set(beasts.map((b) => b.family))].sort().map((name) => {
    const mine = beasts.filter((b) => b.family === name);
    const levels = mine.map((b) => b.level_min).filter((l): l is number => l !== null);
    return {
      name,
      beasts: mine.length,
      confirmed: mine.filter((b) => b.tameable || b.tamed).length,
      levelMin: levels.length ? Math.min(...levels) : null,
      levelMax: levels.length ? Math.max(...mine.map((b) => b.level_max ?? b.level_min ?? 0)) : null,
      diets: [...new Set(mine.map((b) => b.diet).filter((d): d is string => !!d))],
      skills: [...new Set(mine.flatMap((b) => b.skills.map((s) => s.name)))].sort(),
      looks: new Set(mine.map((b) => b.displayId).filter((d): d is number => d !== null)).size,
    };
  });
  // Skills: every (name, rank) seen through Beast Lore, with the beasts that carry it.
  const skillMap = new Map<string, { name: string; rank: number | null; beasts: typeof beasts }>();
  for (const b of beasts) for (const s of b.skills) { const key = `${s.name}|${s.rank ?? ""}`; (skillMap.get(key) ?? skillMap.set(key, { name: s.name, rank: s.rank, beasts: [] }).get(key)!).beasts.push(b); }
  const skills = [...skillMap.values()].map((s) => ({ ...s, beasts: s.beasts.sort((a, b) => (a.level_min ?? 999) - (b.level_min ?? 999)).map((b) => ({ id: b.entity_id, name: b.name, family: b.family, level_min: b.level_min, level_max: b.level_max, place: b.places[0] ?? null })) })).sort((a, b) => a.name.localeCompare(b.name) || (a.rank ?? 0) - (b.rank ?? 0));
  // Forms: distinct looks among tamable beasts, by display ID.
  const formMap = new Map<number, typeof beasts>();
  for (const b of beasts) if (b.displayId !== null) (formMap.get(b.displayId) ?? formMap.set(b.displayId, []).get(b.displayId)!).push(b);
  const forms = [...formMap.entries()].map(([displayId, mine]) => ({ displayId, family: mine[0]!.family, unique: mine.length === 1, beasts: mine.map((b) => ({ id: b.entity_id, name: b.name, level_min: b.level_min, level_max: b.level_max, place: b.places[0] ?? null })) })).sort((a, b) => a.family.localeCompare(b.family) || a.beasts.length - b.beasts.length || a.displayId - b.displayId);
  const rows = (family ? beasts.filter((b) => b.family === family) : beasts).map((b) => ({ ...b, place: b.places[0] ?? null, shared: b.displayId !== null ? (formMap.get(b.displayId)?.length ?? 1) : 0 }));
  return { flavor, family, families, skills, forms, rows, total: beasts.length, unknownLook: beasts.filter((b) => b.displayId === null).length };
};
