import { describe, expect, it } from "vitest";
import { kindSignalsFromFacts, unitKind } from "./wiki-format";

const f = (field: string, v: { num?: number; text?: string; json?: unknown } = {}) => ({ field, value_kind: "", value_num: v.num ?? null, value_text: v.text ?? null, value_json: v.json ?? null });

describe("unitKind", () => {
  it("a guard no one has talked to is an NPC once any observer could not attack it", () => {
    expect(unitKind(kindSignalsFromFacts([f("name", { text: "Horde Guard" }), f("attackable", { num: 0 }), f("attackable", { num: 1 })]))).toBe("NPC");
  });
  it("a friendly reaction from any contributor makes an NPC", () => {
    expect(unitKind(kindSignalsFromFacts([f("reaction", { json: { reaction: 2 } }), f("reaction", { json: { reaction: 5 } })]))).toBe("NPC");
  });
  it("a hostile beast with nothing else is a creature", () => {
    expect(unitKind(kindSignalsFromFacts([f("name", { text: "Prairie Wolf" }), f("attackable", { num: 1 }), f("reaction", { json: { reaction: 2 } })]))).toBe("Creature");
  });
  it("an owner's-pet subtitle is not a person", () => {
    expect(unitKind(kindSignalsFromFacts([f("subtitle", { text: "Razormane Hunter's Pet" }), f("attackable", { num: 1 })]))).toBe("Creature");
    expect(unitKind(kindSignalsFromFacts([f("subtitle", { text: "Pongping\u2019s Pet" })]))).toBe("Creature");
  });
  it("a trade subtitle or a role is a person", () => {
    expect(unitKind(kindSignalsFromFacts([f("subtitle", { text: "Weaponsmith" })]))).toBe("NPC");
    expect(unitKind(kindSignalsFromFacts([f("role:vendor", { num: 1 })]))).toBe("NPC");
  });
});
