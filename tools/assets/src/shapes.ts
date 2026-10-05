/**
 * Outline tracing for map shapes (D-0047): a binary mask -> outer contours ->
 * simplified polygons. Marching squares over cell corners, then
 * Ramer-Douglas-Peucker simplification.
 */
export interface Pt { x: number; y: number }

/** Contours (closed, in pixel coords) of a w x h mask, largest first. */
export function traceContours(mask: Uint8Array, w: number, h: number, minArea = 40): Pt[][] {
  // Pad by one so every component is enclosed.
  const W = w + 2, H = h + 2;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[(y + 1) * W + x + 1] = mask[y * w + x]!;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? m[y * W + x]! : 0);
  // Build directed edges between cell corners along boundaries (set pixel on the left of the direction of travel, keeping the shape on the left).
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (W + 1) + x;
  const add = (ax: number, ay: number, bx: number, by: number) => { const k = key(ax, ay); (next.get(k) ?? next.set(k, []).get(k)!).push(key(bx, by)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y);           // top edge, travelling right
    if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);   // right edge, travelling down
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);   // bottom edge, travelling left
    if (!at(x - 1, y)) add(x, y + 1, x, y);           // left edge, travelling up
  }
  const contours: Pt[][] = [];
  const used = new Set<string>();
  for (const [start, outs] of next) {
    for (const first of outs) {
      const ek = `${start}>${first}`;
      if (used.has(ek)) continue;
      const loop: number[] = [start];
      let prev = start, cur = first;
      used.add(ek);
      let guard = 0;
      while (cur !== start && guard++ < 2_000_000) {
        loop.push(cur);
        const outsC = next.get(cur) ?? [];
        // prefer turning left (keeps outer boundaries coherent): pick the out-edge not yet used, preferring the one that turns most left
        let chosen = -1;
        const dx = (cur % (W + 1)) - (prev % (W + 1)), dy = Math.floor(cur / (W + 1)) - Math.floor(prev / (W + 1));
        let best = -9;
        for (const o of outsC) {
          if (used.has(`${cur}>${o}`)) continue;
          const ox = (o % (W + 1)) - (cur % (W + 1)), oy = Math.floor(o / (W + 1)) - Math.floor(cur / (W + 1));
          const cross = dx * oy - dy * ox; // left turn positive (y down)
          const dot = dx * ox + dy * oy;
          const score = cross * 2 + dot;
          if (score > best) { best = score; chosen = o; }
        }
        if (chosen < 0) break;
        used.add(`${cur}>${chosen}`);
        prev = cur; cur = chosen;
      }
      if (loop.length > 3) contours.push(loop.map((k) => ({ x: (k % (W + 1)) - 1, y: Math.floor(k / (W + 1)) - 1 })));
    }
  }
  const area = (c: Pt[]) => Math.abs(c.reduce((s, p, i) => { const q = c[(i + 1) % c.length]!; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
  // outer boundaries run clockwise in screen coordinates with this edge orientation; drop holes (counter-clockwise) and specks
  return contours.filter((c) => signedArea(c) > 0 && area(c) >= minArea).sort((a, b) => area(b) - area(a));
}

function signedArea(c: Pt[]): number {
  return c.reduce((s, p, i) => { const q = c[(i + 1) % c.length]!; return s + p.x * q.y - q.x * p.y; }, 0) / 2;
}

/** Ramer-Douglas-Peucker on a closed polygon. */
export function simplify(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 5) return points;
  const d2 = (p: Pt, a: Pt, b: Pt) => {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (!l2) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2; t = Math.max(0, Math.min(1, t));
    return (p.x - (a.x + t * (b.x - a.x))) ** 2 + (p.y - (a.y + t * (b.y - a.y))) ** 2;
  };
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts;
    let idx = -1, max = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = d2(pts[i]!, pts[0]!, pts[pts.length - 1]!); if (d > max) { max = d; idx = i; } }
    if (max > epsilon * epsilon) { const a = rdp(pts.slice(0, idx + 1)), b = rdp(pts.slice(idx)); return [...a.slice(0, -1), ...b]; }
    return [pts[0]!, pts[pts.length - 1]!];
  };
  // split at the farthest point from the first so the closed loop simplifies as two open chains
  let far = 0, fd = 0;
  for (let i = 1; i < points.length; i++) { const d = (points[i]!.x - points[0]!.x) ** 2 + (points[i]!.y - points[0]!.y) ** 2; if (d > fd) { fd = d; far = i; } }
  const a = rdp(points.slice(0, far + 1)), b = rdp([...points.slice(far), points[0]!]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** SVG path for polygons already in output units. */
export function toPath(polys: Pt[][], digits = 1): string {
  const f = (v: number) => v.toFixed(digits);
  return polys.map((p) => "M" + p.map((q, i) => `${i ? "L" : ""}${f(q.x)} ${f(q.y)}`).join("") + "Z").join("");
}
