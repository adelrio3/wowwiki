/**
 * Pure evaluation (docs/06): a catalog plus a character's state in, progress
 * per achievement out, with the server time the last required piece arrived
 * as the earned date, so re-evaluation gives the same dates.
 */
import type { Achievement, Catalog, CharacterState, Criterion, CriterionProgress, Progress } from "./types.js";

const later = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : a ?? b);

/** The time the n-th item (sorted by time) arrived, or null when times are missing. */
function nthAt(items: Array<string | null>, n: number): string | null {
  if (items.length < n) return null;
  const known = items.filter((t): t is string => t !== null).sort();
  return known.length >= n ? known[n - 1]! : null;
}

function evaluateCriterion(c: Criterion, s: CharacterState, done: Map<string, Progress>): CriterionProgress {
  switch (c.type) {
    case "level": return { label: c.label ?? `Reach level ${c.n}`, current: Math.min(s.level, c.n), required: c.n, met: s.level >= c.n, at: s.levelAt[c.n] ?? null };
    case "hardcore_level": { const met = s.hardcore && s.level >= c.n; return { label: c.label ?? `Reach level ${c.n} on a Hardcore realm`, current: s.hardcore ? Math.min(s.level, c.n) : 0, required: c.n, met, at: met ? (s.levelAt[c.n] ?? null) : null }; }
    case "quest_count": return { label: c.label ?? `Complete ${c.n} quests`, current: Math.min(s.quests.length, c.n), required: c.n, met: s.quests.length >= c.n, at: nthAt(s.quests.map((q) => q.at), c.n) };
    case "quest_count_continent": { const mine = s.quests.filter((q) => q.continent === c.continent); return { label: c.label ?? `Complete ${c.n} quests`, current: Math.min(mine.length, c.n), required: c.n, met: mine.length >= c.n, at: nthAt(mine.map((q) => q.at), c.n) }; }
    case "area_explore": { const hit = s.explored.find((e) => e.areaId === c.areaId); return { label: c.label, current: hit ? 1 : 0, required: 1, met: !!hit, at: hit?.at ?? null }; }
    case "taxi_count": return { label: c.label ?? `Learn ${c.n} flight paths`, current: Math.min(s.taxi.length, c.n), required: c.n, met: s.taxi.length >= c.n, at: nthAt(s.taxi.map((t) => t.at), c.n) };
    case "pet_count": return { label: c.label ?? `Have ${c.n} pets`, current: Math.min(s.pets, c.n), required: c.n, met: s.pets >= c.n, at: null };
    case "achievement": { const p = done.get(c.key); return { label: c.label ?? c.key, current: p?.earned ? 1 : 0, required: 1, met: !!p?.earned, at: p?.earnedAt ?? null }; }
  }
}

function evaluateOne(a: Achievement, s: CharacterState, done: Map<string, Progress>): Progress {
  const criteria = a.criteria.map((c) => evaluateCriterion(c, s, done));
  const need = a.requireAny ?? criteria.length;
  const metOnes = criteria.filter((c) => c.met);
  const earned = metOnes.length >= need;
  let earnedAt: string | null = null;
  if (earned) {
    // the moment the last needed criterion was met: the n-th earliest among the met ones
    const times = metOnes.map((c) => c.at);
    earnedAt = a.requireAny ? nthAt(times, need) : times.reduce<string | null>((acc, t) => (t === null ? acc : later(acc, t)), null);
  }
  const fraction = criteria.length ? Math.min(1, criteria.reduce((n, c) => n + c.current / c.required, 0) / (a.requireAny ?? criteria.length)) : 0;
  return { key: a.key, earned, earnedAt, points: earned ? a.points : 0, criteria, fraction };
}

/** Metas depend on other achievements, so evaluate in dependency order. */
export function evaluate(catalog: Catalog, state: CharacterState): Progress[] {
  const done = new Map<string, Progress>();
  const pending = [...catalog.achievements];
  let guard = 0;
  while (pending.length && guard++ < 50) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const a = pending[i]!;
      const deps = a.criteria.filter((c): c is Extract<Criterion, { type: "achievement" }> => c.type === "achievement");
      if (deps.every((d) => done.has(d.key))) { done.set(a.key, evaluateOne(a, state, done)); pending.splice(i, 1); }
    }
  }
  for (const a of pending) done.set(a.key, evaluateOne(a, state, done)); // unresolved metas evaluate against what exists
  return catalog.achievements.map((a) => done.get(a.key)!);
}

export const totalPoints = (progress: Progress[]) => progress.reduce((n, p) => n + p.points, 0);
