import { describe, expect, it } from "vitest";
import { composeMap, layoutHash } from "./compose";
import { blteDecode } from "./blte";
import { deflateSync } from "node:zlib";

/** A 4x4 BLP2 in uncompressed ARGB with one solid colour and the given alpha. */
function blp(r: number, g: number, b: number, a: number): Buffer {
  const header = Buffer.alloc(148 + 1024);
  header.write("BLP2", 0, "ascii");
  header.writeUInt32LE(1, 4);
  header.writeUInt8(3, 8); header.writeUInt8(8, 9); header.writeUInt8(0, 10); header.writeUInt8(0, 11);
  header.writeUInt32LE(4, 12); header.writeUInt32LE(4, 16);
  header.writeUInt32LE(header.length, 20); header.writeUInt32LE(4 * 4 * 4, 84);
  const px = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) { px[i * 4] = b; px[i * 4 + 1] = g; px[i * 4 + 2] = r; px[i * 4 + 3] = a; }
  return Buffer.concat([header, px]);
}

describe("composeMap", () => {
  it("pastes base tiles in a grid and blends overlays by alpha", async () => {
    const files: Record<number, Buffer> = { 1: blp(10, 20, 30, 255), 2: blp(40, 50, 60, 255), 9: blp(200, 0, 0, 128) };
    const canvas = await composeMap({ layer: { w: 8, h: 4, tw: 4, th: 4, t: [1, 2] }, overlays: [{ w: 4, h: 4, x: 4, y: 0, t: [9] }] }, async (id) => files[id]!);
    expect(canvas.width).toBe(8);
    expect([...canvas.data.subarray(0, 4)]).toEqual([10, 20, 30, 255]);
    // second tile, blended half with red
    const p = (4 * 4);
    expect(canvas.data[p]).toBe(Math.round(200 * 0.502 + 40 * 0.498));
    expect(canvas.data[p + 3]).toBe(255);
  });
  it("hashes layouts independent of overlay order", () => {
    const a = layoutHash({ layer: { w: 1, h: 1, tw: 1, th: 1, t: [1] }, overlays: [{ w: 1, h: 1, x: 0, y: 0, t: [2] }, { w: 1, h: 1, x: 5, y: 0, t: [3] }] });
    const b = layoutHash({ layer: { w: 1, h: 1, tw: 1, th: 1, t: [1] }, overlays: [{ w: 1, h: 1, x: 5, y: 0, t: [3] }, { w: 1, h: 1, x: 0, y: 0, t: [2] }] });
    expect(a).toBe(b);
  });
});

describe("blteDecode", () => {
  it("decodes a zlib chunk", () => {
    const body = deflateSync(Buffer.from("hello"));
    const chunk = Buffer.concat([Buffer.from("Z"), body]);
    const header = Buffer.alloc(12 + 24);
    header.write("BLTE", 0, "ascii"); header.writeUInt32BE(header.length, 4); header.writeUInt8(0x0f, 8); header.writeUInt8(0, 9); header.writeUInt8(0, 10); header.writeUInt8(1, 11);
    header.writeUInt32BE(chunk.length, 12); header.writeUInt32BE(5, 16);
    expect(blteDecode(Buffer.concat([header, chunk])).toString()).toBe("hello");
  });
});
