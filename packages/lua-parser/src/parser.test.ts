import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSavedVariables, LuaParseError } from "./parser.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "..", "fixtures", name), "utf8");

describe("parseSavedVariables", () => {
  it("parses scalars, nested tables, arrays, and escapes", () => {
    const doc = parseSavedVariables(`
      A = {
        ["s"] = "line\\nbreak \\"quoted\\" pipe\\124r tab\\t",
        ["n"] = -12.5,
        ["e"] = 1e3,
        ["b"] = true,
        ["f"] = false,
        ["nil"] = nil,
        ["arr"] = { "x", "y", { ["k"] = 1 } },
        ["sparse"] = { [1] = "a", [3] = "c" },
        ["ids"] = { ["2955"] = { ["id"] = 2955 } },
        ["empty"] = {},
        bare = 7,
      }
      B = 42
    `);
    const a = doc.A as Record<string, unknown>;
    expect(a.s).toBe('line\nbreak "quoted" pipe|r tab\t');
    expect(a.n).toBe(-12.5);
    expect(a.e).toBe(1000);
    expect(a.b).toBe(true);
    expect(a.f).toBe(false);
    expect("nil" in a).toBe(false);
    expect(a.arr).toEqual(["x", "y", { k: 1 }]);
    expect(a.sparse).toEqual({ "1": "a", "3": "c" });
    expect(a.ids).toEqual({ "2955": { id: 2955 } });
    expect(a.empty).toEqual({});
    expect(a.bare).toBe(7);
    expect(doc.B).toBe(42);
  });

  it("rejects code and non-literal constructs", () => {
    expect(() => parseSavedVariables(`A = f()`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`A = 1 + 2`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`A = { x }`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`A = [[long]]`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`A = 'single'`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`--[[ block ]] A = 1`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`A = { ["k"] = }`)).toThrow(LuaParseError);
    expect(() => parseSavedVariables(`A = { ["k"] = 1 `)).toThrow(LuaParseError);
  });

  it("skips line comments and reports positions", () => {
    const doc = parseSavedVariables(`-- header\nA = { -- inline\n ["k"] = 1,\n}`);
    expect(doc.A).toEqual({ k: 1 });
    try {
      parseSavedVariables(`A = {\n ["k"] = @,\n}`);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LuaParseError);
      expect((e as LuaParseError).line).toBe(2);
    }
  });

  it("parses a real Classic Era SavedVariables file (probe run 3)", () => {
    const doc = parseSavedVariables(fixture("probe-era-1.15.9-run3.lua"));
    const db = doc.WoWCompendiumProbeDB as Record<string, any>;
    expect(db.version).toBe(2);
    // the probe stringified its keys, so this is an object, not an array
    expect(db.values.buildInfo["1"]).toBe("1.15.9");
    expect(db.values.buildInfo["2"]).toBe("70003");
    expect(db.values.buildInfo["4"]).toBe(11509);
    expect(db.values.projectID).toBe(2);
    expect(db.values.locale).toBe("enUS");
    // positional samples become arrays; string-keyed samples become objects
    expect(Array.isArray(db.samples.loot)).toBe(true);
    expect(db.samples.loot[2].slots["1"].sources["1"]).toBe("GameObject-0-5162-1-56-2912-000040695B");
    expect(typeof db.samples.target).toBe("object");
    expect(Array.isArray(db.samples.target)).toBe(false);
    // multi-line quest text was written with \n escapes
    expect(db.login.questLogFirst.text["1"]).toContain("\n\n");
    // item links keep their pipes
    expect(db.login.itemInfo["2"]).toContain("|Hitem:6948");
  });

  it("parses probe run 1 (24-key truncated tables, nested placeholders)", () => {
    const doc = parseSavedVariables(fixture("probe-era-1.15.9-run1.lua"));
    const db = doc.WoWCompendiumProbeDB as Record<string, any>;
    expect(db.login["..."]).toBe(true);
    expect(db.samples.nameplate).toHaveLength(5);
    expect(db.events.HARDCORE_DEATH).toBe("unknown");
  });
});
