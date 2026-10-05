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
import type { Locator } from "@compendium/map-art";

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
  const out: Record<string, { layer: { w: number; h: number; tw: number; th: number; t: number[]; aid: number }; overlays: Array<{ w: number; h: number; x: number; y: number; t: number[] }>; name: string; parent: number; type: number; area?: number; bounds?: { x: number; y: number; w: number; h: number } }> = {};
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
