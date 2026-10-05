/**
 * The Classic Era catalog (D-0032, D-0051): reconstructed from Wrath's
 * achievements for this content where our captures can measure them, plus a
 * few Compendium originals. Exploration checklists come from the client's own
 * overlay table (era-areas.json), never from authored subzone lists. Criteria
 * never change once released; new achievements may be added (bump `version`).
 */
import type { Achievement, Catalog } from "../types.js";
import areasJson from "./era-areas.json" with { type: "json" };

const areas = areasJson as Record<string, { name: string; parent: number; areas: Array<{ id: number; name: string }> }>;
const KALIMDOR = 1414, EASTERN_KINGDOMS = 1415;

const slug = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const achievements: Achievement[] = [];

// General: levels, as Wrath awarded them.
for (const n of [10, 20, 30, 40, 50, 60]) achievements.push({ key: `level-${n}`, name: `Level ${n}`, description: `Reach level ${n}.`, category: "general", points: 10, criteria: [{ type: "level", n }] });

// Quests: the completed-count ladder and Loremaster per continent.
for (const n of [50, 100, 250, 500, 1000, 1500]) achievements.push({ key: `quests-${n}`, name: `${n} Quests Completed`, description: `Complete ${n} quests.`, category: "quests", points: 10, criteria: [{ type: "quest_count", n }] });
achievements.push({ key: "quests-3000", name: "3000 Quests Completed", description: "Complete 3000 quests.", category: "quests", points: 20, criteria: [{ type: "quest_count", n: 3000 }] });
achievements.push({ key: "loremaster-eastern-kingdoms", name: "Loremaster of Eastern Kingdoms", description: "Complete 550 quests in Eastern Kingdoms.", category: "quests", points: 10, criteria: [{ type: "quest_count_continent", continent: EASTERN_KINGDOMS, n: 550, label: "Quests completed in Eastern Kingdoms" }] });
achievements.push({ key: "loremaster-kalimdor", name: "Loremaster of Kalimdor", description: "Complete 700 quests in Kalimdor.", category: "quests", points: 10, criteria: [{ type: "quest_count_continent", continent: KALIMDOR, n: 700, label: "Quests completed in Kalimdor" }] });
achievements.push({ key: "loremaster", name: "Loremaster", description: "Complete the quest achievements for both continents.", category: "quests", points: 25, criteria: [{ type: "achievement", key: "loremaster-eastern-kingdoms", label: "Loremaster of Eastern Kingdoms" }, { type: "achievement", key: "loremaster-kalimdor", label: "Loremaster of Kalimdor" }] });

// Exploration: one per zone under a continent, from the client's own area lists; continent metas; World Explorer.
const byContinent: Record<number, string[]> = { [KALIMDOR]: [], [EASTERN_KINGDOMS]: [] };
for (const [mapId, z] of Object.entries(areas).sort(([, a], [, b]) => a.name.localeCompare(b.name))) {
  if (!(z.parent in byContinent)) continue;
  const key = `explore-${slug(z.name)}`;
  byContinent[z.parent]!.push(key);
  achievements.push({ key, name: `Explore ${z.name}`, description: `Explore ${z.name}, revealing the covered areas of the world map.`, category: `exploration-${z.parent}`, points: 10, criteria: z.areas.map((a) => ({ type: "area_explore" as const, areaId: a.id, label: a.name })) });
  void mapId;
}
achievements.push({ key: "explore-kalimdor", name: "Explore Kalimdor", description: "Explore the regions of Kalimdor.", category: "exploration", points: 25, criteria: byContinent[KALIMDOR]!.map((key) => ({ type: "achievement" as const, key, label: achievements.find((a) => a.key === key)!.name })) });
achievements.push({ key: "explore-eastern-kingdoms", name: "Explore Eastern Kingdoms", description: "Explore the regions of Eastern Kingdoms.", category: "exploration", points: 25, criteria: byContinent[EASTERN_KINGDOMS]!.map((key) => ({ type: "achievement" as const, key, label: achievements.find((a) => a.key === key)!.name })) });
achievements.push({ key: "world-explorer", name: "World Explorer", description: "Explore both continents of Azeroth.", category: "exploration", points: 50, criteria: [{ type: "achievement", key: "explore-kalimdor", label: "Explore Kalimdor" }, { type: "achievement", key: "explore-eastern-kingdoms", label: "Explore Eastern Kingdoms" }] });

// Compendium originals (docs/06 "Fun additions"), measured from what the add-on records.
achievements.push({ key: "frequent-flyer-10", name: "Frequent Flyer", description: "Learn 10 flight paths.", category: "general", points: 10, original: true, criteria: [{ type: "taxi_count", n: 10 }] });
achievements.push({ key: "frequent-flyer-25", name: "Seasoned Traveler", description: "Learn 25 flight paths.", category: "general", points: 10, original: true, criteria: [{ type: "taxi_count", n: 25 }] });
achievements.push({ key: "frequent-flyer-45", name: "Wings of Azeroth", description: "Learn 45 flight paths.", category: "general", points: 20, original: true, criteria: [{ type: "taxi_count", n: 45 }] });
achievements.push({ key: "stable-keeper", name: "Stable Keeper", description: "Have three hunter pets, stabled or at your side.", category: "general", points: 10, criteria: [{ type: "pet_count", n: 3 }] });

// Feats of Strength: Hardcore.
achievements.push({ key: "survivor", name: "Survivor", description: "Reach level 60 on a Hardcore realm.", category: "feats", points: 0, feat: true, criteria: [{ type: "hardcore_level", n: 60 }] });

export const era: Catalog = {
  flavor: "era",
  version: 1,
  categories: [
    { key: "general", name: "General" },
    { key: "quests", name: "Quests" },
    { key: "exploration", name: "Exploration" },
    { key: `exploration-${EASTERN_KINGDOMS}`, name: "Eastern Kingdoms", parent: "exploration" },
    { key: `exploration-${KALIMDOR}`, name: "Kalimdor", parent: "exploration" },
    { key: "feats", name: "Feats of Strength" },
  ],
  achievements,
};
