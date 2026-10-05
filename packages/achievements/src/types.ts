/**
 * The shape every catalog shares, modeled on Blizzard's (docs/06): categories,
 * achievements with points and criteria, metas over other achievements.
 */
export type Criterion =
  | { type: "level"; n: number; label?: string }
  | { type: "hardcore_level"; n: number; label?: string }
  | { type: "quest_count"; n: number; label?: string }
  | { type: "quest_count_continent"; continent: number; n: number; label?: string }
  | { type: "area_explore"; areaId: number; label: string }
  | { type: "taxi_count"; n: number; label?: string }
  | { type: "pet_count"; n: number; label?: string }
  | { type: "achievement"; key: string; label?: string };

export interface Achievement {
  key: string;
  name: string;
  description: string;
  category: string;
  points: number;
  /** Feats carry no points and are hidden until earned. */
  feat?: boolean;
  /** Compendium original rather than a reconstruction of a Wrath achievement. */
  original?: boolean;
  criteria: Criterion[];
  /** Every criterion must be met (default) or any `n` of them. */
  requireAny?: number;
}

export interface Catalog {
  flavor: string;
  version: number;
  categories: Array<{ key: string; name: string; parent?: string }>;
  achievements: Achievement[];
}

/** What the engine knows about one character, with the time each piece arrived. */
export interface CharacterState {
  level: number;
  /** server time a level was first seen (level_up events and logins) */
  levelAt: Record<number, string>;
  hardcore: boolean;
  quests: Array<{ id: number; at: string | null; continent: number | null }>;
  explored: Array<{ areaId: number; at: string | null }>;
  taxi: Array<{ nodeId: number; at: string | null }>;
  pets: number;
}

export interface CriterionProgress {
  label: string;
  current: number;
  required: number;
  met: boolean;
  /** when the criterion was met, if known */
  at: string | null;
}

export interface Progress {
  key: string;
  earned: boolean;
  earnedAt: string | null;
  points: number;
  criteria: CriterionProgress[];
  /** 0..1 */
  fraction: number;
}
