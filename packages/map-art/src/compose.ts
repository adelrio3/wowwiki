/**
 * Compose a zone map from its layout facts: the base tile grid plus every
 * explored-area picture, as the client draws them (D-0041). Output is RGBA.
 */
import { decodeBlp, type Rgba } from "./blp.js";

export interface MapLayer { w: number; h: number; tw: number; th: number; t: number[]; aid?: number | null }
export interface MapOverlay { w: number; h: number; x: number; y: number; t: number[] }
export interface MapLayout { layer: MapLayer; overlays: MapOverlay[] }

export type FileLoader = (fdid: number) => Promise<Buffer>;

export interface Canvas { width: number; height: number; data: Buffer }

function blit(dst: Canvas, src: Rgba, left: number, top: number, blend: boolean): void {
  for (let y = 0; y < src.height; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = left + x;
      if (dx < 0 || dx >= dst.width) continue;
      const si = (y * src.width + x) * 4, di = (dy * dst.width + dx) * 4;
      const a = src.data[si + 3]! / 255;
      if (!blend || a >= 1) { dst.data[di] = src.data[si]!; dst.data[di + 1] = src.data[si + 1]!; dst.data[di + 2] = src.data[si + 2]!; dst.data[di + 3] = 255; continue; }
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) dst.data[di + c] = Math.round(src.data[si + c]! * a + dst.data[di + c]! * (1 - a));
      dst.data[di + 3] = 255;
    }
  }
}

/** Tiles of one picture, row-major over `tw`-wide tiles, pasted at (x, y). */
async function paste(dst: Canvas, tiles: number[], widthPx: number, tileW: number, tileH: number, x: number, y: number, load: FileLoader, blend: boolean): Promise<void> {
  const cols = Math.max(1, Math.ceil(widthPx / tileW));
  const images = await Promise.all(tiles.map(async (id) => decodeBlp(await load(id))));
  images.forEach((img, i) => blit(dst, img, x + (i % cols) * tileW, y + Math.floor(i / cols) * tileH, blend));
  void tileH;
}

export async function composeMap(layout: MapLayout, load: FileLoader): Promise<Canvas> {
  const { layer } = layout;
  const canvas: Canvas = { width: layer.w, height: layer.h, data: Buffer.alloc(layer.w * layer.h * 4) };
  await paste(canvas, layer.t, layer.w, layer.tw, layer.th, 0, 0, load, false);
  // Overlays are 256 px tiles; a piece wider than 256 spans several columns.
  for (const o of layout.overlays) await paste(canvas, o.t, o.w, 256, 256, o.x, o.y, load, true);
  return canvas;
}

/** Stable identity of a layout, so a map is recomposed only when its pieces change. */
export function layoutHash(layout: MapLayout): string {
  const key = JSON.stringify({ l: layout.layer, o: [...layout.overlays].sort((a, b) => a.y - b.y || a.x - b.x || a.t[0]! - b.t[0]!) });
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, "0") + key.length.toString(16);
}
