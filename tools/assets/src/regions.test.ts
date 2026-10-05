import { describe, expect, it } from "vitest";
import { erode, growRegions } from "./regions.js";

function grid(rows: string[]) {
  const w = rows[0]!.length, h = rows.length;
  const pick = (ch: string) => { const m = new Uint8Array(w * h); rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) m[y * w + x] = 1; })); return m; };
  return { w, h, pick };
}

describe("growRegions", () => {
  it("fills each drawn cell from its seed and stops at the line between them", () => {
    // two cells split by a vertical line (|), sea (~) to the right; seeds a and b
    const rows = [
      "..........|......~~",
      "..a.......|......~~",
      "..........|..b...~~",
      "..........|......~~",
      "..........|......~~",
      "..........|......~~",
      "..........|......~~",
    ];
    const { w, h, pick } = grid(rows);
    const label = growRegions(w, h, pick("|"), pick("~"), [pick("a"), pick("b")], 50, 0);
    const at = (x: number, y: number) => label[y * w + x];
    expect(at(0, 0)).toBe(1); expect(at(9, 6)).toBe(1);
    expect(at(11, 0)).toBe(2); expect(at(16, 6)).toBe(2);
    expect(at(10, 3)).toBe(0); // the line itself, with no sealing
    expect(at(17, 3)).toBe(0); // the sea
  });
  it("seals over the line but never over the sea", () => {
    const { w, h, pick } = grid(["..a...|..b...~~~", "......|......~~~", "......|......~~~", "......|......~~~", "......|......~~~", "......|......~~~", "......|......~~~"]);
    const label = growRegions(w, h, pick("|"), pick("~"), [pick("a"), pick("b")], 50, 1);
    expect(label[3 * w + 6]).not.toBe(0);
    expect(label[3 * w + 13]).toBe(0);
  });
  it("drops a grown piece too thin to hold a 5 x 5 block", () => {
    const rows = ["..........", "..........", "..a.......", "..........", "..........", "..........", "~~~~~~~~~~", "..........", ".....b....", "..........", "~~~~~~~~~~"];
    const { w, h, pick } = grid(rows);
    const label = growRegions(w, h, new Uint8Array(w * h), pick("~"), [pick("a"), pick("b")], 50, 0);
    expect(label[2 * w + 2]).toBe(1);
    expect(label[8 * w + 5]).toBe(0); // b's strip is three rows tall
  });
});

describe("erode", () => {
  it("shrinks a block by n on every side", () => {
    const { w, h, pick } = grid(["......", ".####.", ".####.", ".####.", ".####.", "......"]);
    const e = erode(pick("#"), w, h, 1);
    expect([...e].reduce((n, v) => n + v, 0)).toBe(4);
  });
});
