import { describe, expect, it } from "vitest";
import { evaluate, totalPoints } from "./engine.js";
import { era } from "./catalogs/era.js";
import type { Catalog, CharacterState } from "./types.js";

const empty: CharacterState = { level: 1, levelAt: {}, hardcore: false, quests: [], explored: [], taxi: [], pets: 0 };

describe("evaluate", () => {
  it("earns levels with the time the level was reached and counts quests toward the ladder", () => {
    const state: CharacterState = { ...empty, level: 23, levelAt: { 10: "2026-10-01T00:00:00Z", 20: "2026-10-03T00:00:00Z" }, quests: Array.from({ length: 60 }, (_, i) => ({ id: i + 1, at: `2026-10-0${1 + (i % 5)}T00:00:00Z`, continent: i < 40 ? 1414 : null })) };
    const p = evaluate(era, state);
    const by = Object.fromEntries(p.map((x) => [x.key, x]));
    expect(by["level-10"]).toMatchObject({ earned: true, earnedAt: "2026-10-01T00:00:00Z", points: 10 });
    expect(by["level-20"]!.earnedAt).toBe("2026-10-03T00:00:00Z");
    expect(by["level-30"]).toMatchObject({ earned: false, points: 0 });
    expect(by["level-30"]!.criteria[0]).toMatchObject({ current: 23, required: 30 });
    expect(by["quests-50"]).toMatchObject({ earned: true, earnedAt: "2026-10-05T00:00:00Z" });
    expect(by["quests-100"]!.fraction).toBeCloseTo(0.6);
    expect(by["loremaster-kalimdor"]!.criteria[0]!.current).toBe(40);
    expect(totalPoints(p)).toBe(30);
  });
  it("earns a zone when every client-listed area is explored, and the metas follow", () => {
    const mulgore = era.achievements.find((a) => a.key === "explore-mulgore")!;
    const all = mulgore.criteria.map((c, i) => ({ areaId: (c as { areaId: number }).areaId, at: `2026-10-02T00:00:${String(i).padStart(2, "0")}Z` }));
    const p = evaluate(era, { ...empty, explored: all.slice(0, -1) });
    expect(p.find((x) => x.key === "explore-mulgore")!.earned).toBe(false);
    const q = evaluate(era, { ...empty, explored: all });
    const m = q.find((x) => x.key === "explore-mulgore")!;
    expect(m.earned).toBe(true);
    expect(m.earnedAt).toBe(all[all.length - 1]!.at);
    const kal = q.find((x) => x.key === "explore-kalimdor")!;
    expect(kal.earned).toBe(false);
    expect(kal.criteria.find((c) => c.label === "Explore Mulgore")!.met).toBe(true);
  });
  it("evaluates metas after their parts whatever the catalog order", () => {
    const cat: Catalog = { flavor: "x", version: 1, categories: [], achievements: [
      { key: "meta", name: "Meta", description: "", category: "g", points: 5, criteria: [{ type: "achievement", key: "a" }, { type: "achievement", key: "b" }] },
      { key: "a", name: "A", description: "", category: "g", points: 1, criteria: [{ type: "level", n: 2 }] },
      { key: "b", name: "B", description: "", category: "g", points: 1, criteria: [{ type: "level", n: 3 }] },
    ] };
    const p = evaluate(cat, { ...empty, level: 3, levelAt: { 2: "2026-01-01T00:00:00Z", 3: "2026-01-02T00:00:00Z" } });
    expect(p[0]).toMatchObject({ key: "meta", earned: true, earnedAt: "2026-01-02T00:00:00Z", points: 5 });
  });
  it("keeps feats pointless and hardcore-only", () => {
    const p = evaluate(era, { ...empty, level: 60, levelAt: { 60: "2026-02-01T00:00:00Z" }, hardcore: false });
    expect(p.find((x) => x.key === "survivor")!.earned).toBe(false);
    const q = evaluate(era, { ...empty, level: 60, levelAt: { 60: "2026-02-01T00:00:00Z" }, hardcore: true });
    expect(q.find((x) => x.key === "survivor")).toMatchObject({ earned: true, points: 0, earnedAt: "2026-02-01T00:00:00Z" });
  });
});
