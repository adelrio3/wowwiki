/**
 * Zone regions on a continent map (D-0047, N-0023). The continent art draws
 * every zone border as a dark line, so the regions come from the picture
 * itself: pixels are grown from each zone's seed (its explored pieces, placed
 * on the continent) across the land but never across a drawn line. Neighbours
 * therefore meet exactly on the border and nothing is left to a guess.
 */
export interface Rgba { width: number; height: number; data: Uint8Array | Uint8ClampedArray | Buffer }

/** 1 where the picture draws a line: luminance well below its surroundings. */
export function lineMask(img: Rgba, radius = 5, drop = 14): Uint8Array {
  const { width: W, height: H, data } = img;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = 0.3 * data[i * 4]! + 0.59 * data[i * 4 + 1]! + 0.11 * data[i * 4 + 2]!;
  // box blur by summed-area table
  const sat = new Float64Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y++) { let row = 0; for (let x = 1; x <= W; x++) { row += lum[(y - 1) * W + x - 1]!; sat[y * (W + 1) + x] = sat[(y - 1) * (W + 1) + x]! + row; } }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.max(0, x - radius), y0 = Math.max(0, y - radius), x1 = Math.min(W, x + radius + 1), y1 = Math.min(H, y + radius + 1);
    const sum = sat[y1 * (W + 1) + x1]! - sat[y0 * (W + 1) + x1]! - sat[y1 * (W + 1) + x0]! + sat[y0 * (W + 1) + x0]!;
    if (lum[y * W + x]! < sum / ((x1 - x0) * (y1 - y0)) - drop) out[y * W + x] = 1;
  }
  return out;
}

/** Mean of `v` over a (2r+1)-square window, by summed-area table. */
function boxMean(v: Float32Array | Uint8Array, W: number, H: number, r: number): Float32Array {
  const sat = new Float64Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y++) { let row = 0; for (let x = 1; x <= W; x++) { row += v[(y - 1) * W + x - 1]!; sat[y * (W + 1) + x] = sat[(y - 1) * (W + 1) + x]! + row; } }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1);
    out[y * W + x] = (sat[y1 * (W + 1) + x1]! - sat[y0 * (W + 1) + x1]! - sat[y1 * (W + 1) + x0]! + sat[y0 * (W + 1) + x0]!) / ((x1 - x0) * (y1 - y0));
  }
  return out;
}

/**
 * 1 where the picture is not land. Two signs, either enough: everything
 * reachable from the picture's edge without crossing a drawn line (the open
 * sea), and the hatched band along every coast, which is pale (low colour
 * saturation) and dense with line pixels at once, a pairing no zone has, or
 * striped line-gap-line down every column. The band is fattened by two pixels so its edge goes with it. Colour alone is no
 * sign: the forests are as green as the sea is teal.
 */
export function seaMask(img: Rgba, lines: Uint8Array): Uint8Array {
  const { width: W, height: H, data } = img;
  const out = new Uint8Array(W * H);
  const satv = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4]!, g = data[i * 4 + 1]!, b = data[i * 4 + 2]!;
    const mx = Math.max(r, g, b); satv[i] = mx ? (mx - Math.min(r, g, b)) / mx : 0;
  }
  const meanSat = boxMean(satv, W, H, 2), density = boxMean(lines, W, H, 7);
  // Hatching the parchment's glow has coloured (near the torn edges) fails the
  // pale test, but it still alternates line and gap every few pixels down a
  // column, which no border or speck does: count the line/gap changes in a
  // 13-pixel column with a more sensitive line test, and average nearby.
  const fine = lineMask(img, 5, 10);
  const alternating = new Uint8Array(W * H);
  for (let y = 6; y < H - 7; y++) for (let x = 0; x < W; x++) { let n = 0; for (let i = -6; i < 6; i++) if (fine[(y + i) * W + x] !== fine[(y + i + 1) * W + x]) n++; if (n >= 4) alternating[y * W + x] = 1; }
  const stripes = boxMean(alternating, W, H, 5);
  const hatched = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if ((meanSat[i]! < 0.48 && density[i]! > 0.15) || stripes[i]! > 0.65) hatched[i] = 1;
  for (let i = 0; i < W * H; i++) if (hatched[i]) { const x = i % W, y = (i - x) / W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) out[yy * W + xx] = 1; } }
  // a fatter copy of the lines so a one-pixel gap in the coastline does not let the sea in
  const fat = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (lines[i]) { const x = i % W, y = (i - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) fat[yy * W + xx] = 1; } }
  const seen = new Uint8Array(W * H);
  let frontier: number[] = [];
  for (let x = 0; x < W; x++) frontier.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) frontier.push(y * W, y * W + W - 1);
  for (const i of frontier) seen[i] = 1;
  while (frontier.length) {
    const next: number[] = [];
    for (const i of frontier) {
      if (fat[i]) continue;
      out[i] = 1;
      const x = i % W, y = (i - x) / W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j < 0 || seen[j]) continue;
        seen[j] = 1; next.push(j);
      }
    }
    frontier = next;
  }
  return out;
}

/** Erode a mask by `n` pixels (4-neighbour). */
export function erode(mask: Uint8Array, w: number, h: number, n: number): Uint8Array {
  let cur = mask;
  for (let k = 0; k < n; k++) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (cur[i] && cur[i - 1] && cur[i + 1] && cur[i - w] && cur[i + w]) next[i] = 1;
    }
    cur = next;
  }
  return cur;
}

/**
 * Grow every seed across the land until it meets a drawn line, the sea, another
 * region, or `reach` pixels from its seed; then let the regions close over the
 * lines and specks between them (`seal` pixels). Returns a label per pixel
 * (0 = none) in the order of `seeds`, 1-based.
 */
export function growRegions(w: number, h: number, lines: Uint8Array, sea: Uint8Array, seeds: Uint8Array[], reach = 90, seal = 4): Uint16Array {
  const label = new Uint16Array(w * h);
  const dist = new Int32Array(w * h).fill(-1);
  let queue: number[] = [];
  seeds.forEach((s, k) => { for (let i = 0; i < w * h; i++) if (s[i] && !lines[i] && !sea[i]) { label[i] = k + 1; dist[i] = 0; queue.push(i); } });
  const step = (pass: (i: number, j: number) => boolean, limit: number) => {
    let frontier = queue;
    for (let d = 1; d <= limit && frontier.length; d++) {
      const next: number[] = [];
      for (const i of frontier) {
        const x = i % w, y = (i - x) / w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0 || label[j] || !pass(i, j)) continue;
          label[j] = label[i]!; dist[j] = d; next.push(j);
        }
      }
      frontier = next;
    }
    queue = [];
  };
  step((_, j) => !lines[j] && !sea[j], reach);
  // Drop every grown piece too thin to hold a 5 x 5 block: the strips between
  // the hatch lines of the coastal sea, and slivers between doubled borders.
  const seen = new Uint8Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!label[s] || seen[s]) continue;
    const piece: number[] = [s]; seen[s] = 1;
    for (let k = 0; k < piece.length; k++) {
      const i = piece[k]!, x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && label[j] === label[s]) { seen[j] = 1; piece.push(j); }
      }
    }
    const thick = piece.some((i) => { const x = i % w, y = (i - x) / w; if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (label[(y + dy) * w + x + dx] !== label[s]) return false; return true; });
    if (!thick) for (const i of piece) label[i] = 0;
  }
  // seal: cross lines and specks but never the sea
  for (let i = 0; i < w * h; i++) if (label[i]) queue.push(i);
  step((_, j) => !sea[j], seal);
  return label;
}
