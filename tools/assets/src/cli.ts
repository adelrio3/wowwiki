/**
 * Asset tool. `locator`: build the per-build file locator the site uses to
 * fetch map art from Blizzard's content servers with one ranged request
 * each (N-0020). Covers every file under interface/worldmap/ in the
 * community listfile, so any map the add-on catalogs can be composed.
 *
 *   pnpm --filter @compendium/assets locator --product wow_classic_era --flavor era
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Casc, type Product } from "./tact.js";
import { composeMap, decodeBlp, type Locator } from "@compendium/map-art";
import { simplify, toPath, traceContours, type Pt } from "./shapes.js";

const args = Object.fromEntries(process.argv.slice(3).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] ?? "true"] : [])).filter((p) => p.length));
const cmd = process.argv[2];

async function listfileFdids(prefix: string): Promise<Map<number, string>> {
  const cache = join(process.env.TACT_CACHE ?? join(process.cwd(), ".tact-cache"), "community-listfile.csv");
  mkdirSync(join(cache, ".."), { recursive: true });
  if (!existsSync(cache)) {
    const res = await fetch("https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv");
    writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
  }
  const out = new Map<number, string>();
  for (const line of readFileSync(cache, "utf8").split("\n")) {
    const i = line.indexOf(";");
    if (i > 0 && line.startsWith(prefix, i + 1)) out.set(Number(line.slice(0, i)), line.slice(i + 1).trim());
  }
  return out;
}

/**
 * `layouts`: every map's art layout for one build, from the client's own
 * database tables (UiMap, UiMapXMapArt, UiMapArt, UiMapArtStyleLayer,
 * UiMapArtTile, WorldMapOverlay, WorldMapOverlayTile) as exported by wago.tools.
 * A bootstrap so maps exist before any contributor's catalog arrives (D-0044);
 * the add-on's catalog stays the live source and overrides per map.
 */
async function csv(table: string, build: string): Promise<Array<Record<string, string>>> {
  const cacheDir = process.env.TACT_CACHE ?? join(process.cwd(), ".tact-cache");
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${table}-${build}.csv`);
  if (!existsSync(file)) {
    const res = await fetch(`https://wago.tools/db2/${table}/csv?build=${build}`);
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    writeFileSync(file, await res.text());
  }
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = lines[0]!.split(",");
  return lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i]!, v])));
}

if (cmd === "layouts") {
  const build = args.build ?? "1.15.9.70003";
  const flavor = args.flavor ?? "era";
  const [maps, xart, arts, styles, tiles, overlays, otiles, assignments] = await Promise.all(["UiMap", "UiMapXMapArt", "UiMapArt", "UiMapArtStyleLayer", "UiMapArtTile", "WorldMapOverlay", "WorldMapOverlayTile", "UiMapAssignment"].map((t) => csv(t, build)));
  // World-coordinate box per map (WoW's first axis runs north, the second west), used
  // to place a zone's rectangle on its parent's map.
  const box = new Map<string, { n0: number; w0: number; n1: number; w1: number; area: number }>();
  for (const a of assignments) {
    if (a.OrderIndex !== "0" || box.has(a.UiMapID!)) continue;
    box.set(a.UiMapID!, { n0: Number(a.Region_0), w0: Number(a.Region_1), n1: Number(a.Region_3), w1: Number(a.Region_4), area: Number(a.AreaID) });
  }
  const boundsOn = (mapId: string, parentId: string) => {
    const z = box.get(mapId), p = box.get(parentId);
    if (!z || !p) return undefined;
    const left = (p.w1 - z.w1) / (p.w1 - p.w0), right = (p.w1 - z.w0) / (p.w1 - p.w0);
    const top = (p.n1 - z.n1) / (p.n1 - p.n0), bottom = (p.n1 - z.n0) / (p.n1 - p.n0);
    const r = (v: number) => Math.round(v * 10000) / 10000;
    return { x: r(left), y: r(top), w: r(right - left), h: r(bottom - top) };
  };
  const styleOf = new Map(arts.map((a) => [a.ID!, a.UiMapArtStyleID!]));
  const layerOf = new Map(styles.filter((l) => l.LayerIndex === "0").map((l) => [l.UiMapArtStyleID!, l]));
  const out: Record<string, { layer: { w: number; h: number; tw: number; th: number; t: number[]; aid: number }; overlays: Array<{ w: number; h: number; x: number; y: number; t: number[] }>; name: string; parent: number; type: number; area?: number; bounds?: { x: number; y: number; w: number; h: number }; shape?: string }> = {};
  for (const x of xart) {
    if (x.PhaseID !== "0") continue;
    const artId = x.UiMapArtID!, mapId = x.UiMapID!;
    const style = layerOf.get(styleOf.get(artId) ?? "");
    const base = tiles.filter((t) => t.UiMapArtID === artId && t.LayerIndex === "0").sort((a, b) => Number(a.RowIndex) - Number(b.RowIndex) || Number(a.ColIndex) - Number(b.ColIndex));
    if (!style || !base.length) continue;
    const ov = overlays.filter((o) => o.UiMapArtID === artId).map((o) => ({
      w: Number(o.TextureWidth), h: Number(o.TextureHeight), x: Number(o.OffsetX), y: Number(o.OffsetY),
      t: otiles.filter((t) => t.WorldMapOverlayID === o.ID && t.LayerIndex === "0").sort((a, b) => Number(a.RowIndex) - Number(b.RowIndex) || Number(a.ColIndex) - Number(b.ColIndex)).map((t) => Number(t.FileDataID)),
    })).filter((o) => o.t.length);
    const row = maps.find((m) => m.ID === mapId);
    out[mapId] = { name: (row?.Name_lang ?? "").replace(/^"|"$/g, ""), parent: Number(row?.ParentUiMapID ?? 0), type: Number(row?.Type ?? 3), area: box.get(mapId)?.area || undefined, bounds: boundsOn(mapId, row?.ParentUiMapID ?? "0"), layer: { w: Number(style.LayerWidth), h: Number(style.LayerHeight), tw: Number(style.TileWidth), th: Number(style.TileHeight), t: base.map((t) => Number(t.FileDataID)), aid: Number(artId) }, overlays: ov };
  }
  // Shapes (D-0047). A zone's shape is the union of its own explored pieces,
  // carried onto its continent through its world-coordinate box; a continent's
  // shape on the world map is its drawn landmass, found by colour.
  if (args.shapes !== "false") {
    const product = (args.product ?? "wow_classic_era") as Product;
    const casc = await Casc.open(product);
    const SCALE = 2;
    const unitsOf = (poly: Pt[], W: number, H: number, b: { x: number; y: number; w: number; h: number }) => poly.map((q) => ({ x: (b.x + (q.x * SCALE / W) * b.w) * 100, y: (b.y + (q.y * SCALE / H) * b.h) * (100 * 668 / 1002) }));
    for (const [id, m] of Object.entries(out)) {
      if (!m.bounds || m.type !== 3) continue;
      const W = m.layer.w, H = m.layer.h, w = Math.ceil(W / SCALE), h = Math.ceil(H / SCALE);
      const mask = new Uint8Array(w * h);
      for (const o of m.overlays) {
        const cols = Math.max(1, Math.ceil(o.w / 256));
        for (let i = 0; i < o.t.length; i++) {
          const img = decodeBlp(await casc.file(o.t[i]!));
          const ox = o.x + (i % cols) * 256, oy = o.y + Math.floor(i / cols) * 256;
          for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
            if (img.data[(y * img.width + x) * 4 + 3]! > 96) { const mx = Math.floor((ox + x) / SCALE), my = Math.floor((oy + y) / SCALE); if (mx >= 0 && my >= 0 && mx < w && my < h) mask[my * w + mx] = 1; }
          }
        }
      }
      const contours = traceContours(mask, w, h, 60).slice(0, 4);
      if (contours.length) m.shape = toPath(contours.map((c) => unitsOf(simplify(c, 1.2), W, H, m.bounds!)));
      else { const b = m.bounds, hh = 100 * 668 / 1002; m.shape = toPath([[{ x: b.x * 100, y: b.y * hh }, { x: (b.x + b.w) * 100, y: b.y * hh }, { x: (b.x + b.w) * 100, y: (b.y + b.h) * hh }, { x: b.x * 100, y: (b.y + b.h) * hh }]]); }
      console.error(`${m.name}: ${contours.length ? contours.length + " outline(s)" : "box"}`);
    }
    // continents on the world map: the drawn land is orange (red well above green) on a teal parchment whose stains are duller
    const world = Object.entries(out).find(([, m]) => m.type === 1);
    if (world) {
      const canvas = await composeMap({ layer: world[1].layer, overlays: [] }, (fdid) => casc.file(fdid));
      const W = canvas.width, H = canvas.height, w = Math.ceil(W / SCALE), h = Math.ceil(H / SCALE);
      const mask = new Uint8Array(w * h);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (x < W * 0.04 || x > W * 0.96 || y < H * 0.04 || y > H * 0.96) continue; // the torn parchment edge
        const i = (y * W + x) * 4, r = canvas.data[i]!, g = canvas.data[i + 1]!, b = canvas.data[i + 2]!;
        if (r > 135 && r - g >= 36 && r - b > 70 && g > 80) mask[Math.floor(y / SCALE) * w + Math.floor(x / SCALE)] = 1;
      }
      // Every land mass at least a tenth of the largest (Lordaeron is drawn apart from the rest of
      // the Eastern Kingdoms); each goes to the continent on its side of the Maelstrom.
      const area = (c: { x: number; y: number }[]) => Math.abs(c.reduce((s, p, i) => { const q = c[(i + 1) % c.length]!; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
      const all = traceContours(mask, w, h, 2000);
      const land = all.filter((c) => area(c) >= area(all[0]!) * 0.1);
      const continents = Object.entries(out).filter(([, m]) => m.type === 2 && m.parent === Number(world[0]));
      const west = continents.find(([, m]) => m.name === "Kalimdor"), east = continents.find(([, m]) => m.name === "Eastern Kingdoms");
      const toUnits = (c: { x: number; y: number }[]) => simplify(c, 1.2).map((q) => ({ x: (q.x * SCALE / W) * 100, y: (q.y * SCALE / H) * (100 * H / W) }));
      for (const [side, entry] of [["west", west], ["east", east]] as const) {
        if (!entry) continue;
        const mine = land.filter((c) => (c.reduce((s, p) => s + p.x, 0) / c.length < w / 2) === (side === "west"));
        if (mine.length) { entry[1].shape = toPath(mine.map(toUnits)); console.error(`${entry[1].name}: world outline, ${mine.length} land mass(es)`); }
      }
    }
  }
  const buildId = build.split(".").pop();
  const outPath = args.out ?? join(process.cwd(), "..", "..", "apps", "web", "src", "lib", "server", "map-art", "layouts", `${flavor}-${buildId}.json`);
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out));
  console.error(`wrote ${outPath}: ${Object.keys(out).length} maps, ${Object.values(out).reduce((n, m) => n + m.overlays.length, 0)} explored pieces`);
} else if (cmd === "locator") {
  const product = (args.product ?? "wow_classic_era") as Product;
  const flavor = args.flavor ?? "era";
  const prefix = args.prefix ?? "interface/worldmap/";
  const casc = await Casc.open(product, (d, t) => { if (d === t) console.error(`indexes loaded: ${t}`); });
  const names = await listfileFdids(prefix);
  console.error(`${names.size} files under ${prefix} in the listfile`);
  const loc: Locator = { product, build: casc.build.buildId, version: casc.build.version, cdnHost: casc.build.cdnHost, cdnPath: casc.build.cdnPath, files: {} };
  let missing = 0;
  for (const fdid of [...names.keys()].sort((a, b) => a - b)) {
    const where = casc.locate(fdid);
    if (where) loc.files[fdid] = [where.hash, where.offset, where.size];
    else missing++;
  }
  const out = args.out ?? join(process.cwd(), "..", "..", "apps", "web", "src", "lib", "server", "map-art", "locators", `${flavor}-${loc.build}.json`);
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, JSON.stringify(loc));
  console.error(`wrote ${out}: ${Object.keys(loc.files).length} files located, ${missing} not in this build`);
} else {
  console.error("usage: cli.ts locator [--product wow_classic_era] [--flavor era] [--prefix interface/worldmap/] [--out file]\n       cli.ts layouts [--build 1.15.9.70003] [--flavor era] [--out file]");
  process.exit(2);
}
