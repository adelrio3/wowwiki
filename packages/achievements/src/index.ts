export * from "./types.js";
export { evaluate, totalPoints } from "./engine.js";
export { era } from "./catalogs/era.js";
import { era } from "./catalogs/era.js";
import type { Catalog } from "./types.js";

/** The catalog for a flavor, or null where none is authored or mirrored yet. */
export function catalogFor(flavor: string): Catalog | null {
  return flavor === "era" ? era : null;
}
