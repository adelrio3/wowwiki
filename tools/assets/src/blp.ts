/**
 * BLP2 texture decoder (the format of every WoW texture) to raw RGBA.
 * Handles DXT1/3/5 and palettized/uncompressed images; mip level 0 only.
 */
export interface Rgba { width: number; height: number; data: Buffer }

export function decodeBlp(buf: Buffer): Rgba {
  if (buf.toString("ascii", 0, 4) !== "BLP2") throw new Error("not BLP2");
  const encoding = buf.readUInt8(8), alphaDepth = buf.readUInt8(9), alphaEncoding = buf.readUInt8(10);
  const width = buf.readUInt32LE(12), height = buf.readUInt32LE(16);
  const offset = buf.readUInt32LE(20), size = buf.readUInt32LE(84);
  const data = Buffer.alloc(width * height * 4);
  const src = buf.subarray(offset, offset + size);
  if (encoding === 2) {
    const mode = alphaEncoding === 7 ? "dxt5" : alphaEncoding === 1 ? "dxt3" : "dxt1";
    decodeDxt(src, width, height, mode, data);
  } else if (encoding === 1) {
    const palette: number[] = [];
    for (let i = 0; i < 256; i++) palette.push(buf.readUInt32LE(148 + i * 4));
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const c = palette[src[i]!]!;
      data[i * 4] = (c >> 16) & 0xff; data[i * 4 + 1] = (c >> 8) & 0xff; data[i * 4 + 2] = c & 0xff;
      let a = 255;
      if (alphaDepth === 8) a = src[n + i]!;
      else if (alphaDepth === 1) a = (src[n + (i >> 3)]! >> (i & 7)) & 1 ? 255 : 0;
      else if (alphaDepth === 4) a = ((src[n + (i >> 1)]! >> ((i & 1) * 4)) & 0xf) * 17;
      data[i * 4 + 3] = a;
    }
  } else if (encoding === 3) {
    for (let i = 0; i < width * height; i++) { data[i * 4] = src[i * 4 + 2]!; data[i * 4 + 1] = src[i * 4 + 1]!; data[i * 4 + 2] = src[i * 4]!; data[i * 4 + 3] = src[i * 4 + 3]!; }
  } else throw new Error(`unsupported BLP encoding ${encoding}`);
  return { width, height, data };
}

function rgb565(v: number): [number, number, number] {
  return [((v >> 11) & 31) * 255 / 31, ((v >> 5) & 63) * 255 / 63, (v & 31) * 255 / 31];
}

function decodeDxt(src: Buffer, width: number, height: number, mode: "dxt1" | "dxt3" | "dxt5", out: Buffer): void {
  const bw = Math.ceil(width / 4), bh = Math.ceil(height / 4);
  const blockBytes = mode === "dxt1" ? 8 : 16;
  let p = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const alpha = new Array<number>(16).fill(255);
    if (mode === "dxt3") {
      for (let i = 0; i < 16; i++) alpha[i] = ((src[p + (i >> 1)]! >> ((i & 1) * 4)) & 0xf) * 17;
      p += 8;
    } else if (mode === "dxt5") {
      const a0 = src[p]!, a1 = src[p + 1]!;
      const table = [a0, a1];
      if (a0 > a1) for (let i = 1; i < 7; i++) table.push(((7 - i) * a0 + i * a1) / 7);
      else { for (let i = 1; i < 5; i++) table.push(((5 - i) * a0 + i * a1) / 5); table.push(0, 255); }
      let bits = 0n;
      for (let i = 0; i < 6; i++) bits |= BigInt(src[p + 2 + i]!) << BigInt(8 * i);
      for (let i = 0; i < 16; i++) alpha[i] = table[Number((bits >> BigInt(3 * i)) & 7n)]!;
      p += 8;
    }
    const c0 = src.readUInt16LE(p), c1 = src.readUInt16LE(p + 2);
    const bits = src.readUInt32LE(p + 4);
    p += 8;
    const [r0, g0, b0] = rgb565(c0), [r1, g1, b1] = rgb565(c1);
    const colors: Array<[number, number, number, number]> = [[r0, g0, b0, 255], [r1, g1, b1, 255]];
    if (mode !== "dxt1" || c0 > c1) colors.push([(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255], [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255]);
    else colors.push([(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255], [0, 0, 0, 0]);
    for (let i = 0; i < 16; i++) {
      const x = bx * 4 + (i & 3), y = by * 4 + (i >> 2);
      if (x >= width || y >= height) continue;
      const c = colors[(bits >> (2 * i)) & 3]!;
      const o = (y * width + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = mode === "dxt1" ? c[3] : alpha[i]!;
    }
  }
}
