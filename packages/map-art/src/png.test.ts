import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePng } from "./png.js";

describe("encodePng", () => {
  it("writes a well-formed RGBA PNG whose pixels round-trip", () => {
    const data = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 40]);
    const png = encodePng({ width: 2, height: 2, data });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(2);
    const idatLen = png.readUInt32BE(33);
    expect(png.subarray(37, 41).toString("ascii")).toBe("IDAT");
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    expect([...raw]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 0, 255, 0, 10, 20, 30, 40]);
    expect(png.subarray(-8, -4).toString("ascii")).toBe("IEND");
  });
});
