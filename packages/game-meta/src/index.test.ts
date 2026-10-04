import { describe, expect, it } from "vitest";
import { findBuild, flavorFromFolder, flavorFromProjectId, guessExpansion, parseGuid } from "./index.js";

describe("game-meta", () => {
  it("maps the owner's client", () => {
    expect(flavorFromProjectId(2)).toBe("era");
    expect(flavorFromFolder("_classic_era_")).toBe("era");
    expect(flavorFromFolder("_anniversary_")).toBe("anniversary");
    expect(findBuild("era", 70003)?.patch).toBe("1.15.9");
    expect(guessExpansion("era", "1.15.9")).toBe("Classic");
  });
  it("parses GUIDs seen in the probe", () => {
    expect(parseGuid("Creature-0-5162-1-56-2955-0000405A7D")).toMatchObject({ kind: "Creature", id: 2955, instanceId: 1, zoneUid: 56, spawnUid: "0000405A7D" });
    expect(parseGuid("GameObject-0-5162-1-56-2912-000040695B")).toMatchObject({ kind: "GameObject", id: 2912 });
    expect(parseGuid("Player-5149-04E14735")).toMatchObject({ kind: "Player", realmId: 5149, playerUid: "04E14735" });
    expect(parseGuid("Item-5149-0-400000032551FC36")).toMatchObject({ kind: "Item" });
    expect(parseGuid("nonsense")).toBeUndefined();
  });
});
