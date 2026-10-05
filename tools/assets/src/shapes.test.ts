import { describe, expect, it } from "vitest";
import { simplify, toPath, traceContours } from "./shapes.js";

function mask(rows: string[]): { m: Uint8Array; w: number; h: number } {
  const w = rows[0]!.length, h = rows.length;
  const m = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { m[y * w + x] = c === "#" ? 1 : 0; }));
  return { m, w, h };
}
const area = (c: { x: number; y: number }[]) => Math.abs(c.reduce((s, p, i) => { const q = c[(i + 1) % c.length]!; return s + p.x * q.y - q.x * p.y; }, 0) / 2);

describe("traceContours", () => {
  it("traces a filled rectangle as one loop with its area", () => {
    const { m, w, h } = mask(["......", ".####.", ".####.", ".####.", "......"]);
    const cs = traceContours(m, w, h, 1);
    expect(cs).toHaveLength(1);
    expect(area(cs[0]!)).toBe(12);
    expect(simplify(cs[0]!, 0.5)).toHaveLength(4);
  });
  it("returns separate loops largest first and drops specks and holes", () => {
    const { m, w, h } = mask(["#.......", "........", "..####..", "..#..#..", "..####..", "........", "......##", "......##"]);
    const cs = traceContours(m, w, h, 2);
    expect(cs.map(area)).toEqual([12, 4]);
  });
});

describe("toPath", () => {
  it("writes one closed subpath per polygon", () => {
    expect(toPath([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5.25 }], [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]])).toBe("M0.0 0.0L10.0 0.0L10.0 5.3ZM1.0 1.0L2.0 1.0L2.0 2.0Z");
  });
});
