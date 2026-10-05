/**
 * Zone map assembly (D-0041). Reads a map's layout facts (recorded by the
 * add-on as a client catalog), fetches each client file once from Blizzard's
 * content servers, keeps a copy of every source file in our bucket, composes
 * the finished map, and stores it with a row in `artwork`. Pure JavaScript;
 * runs inside the site's own serverless function.
 */
import { composeMap, decodeBlp, encodeJpeg, encodePng, fetchFromCdn, layoutHash, type Locator, type MapLayout, type MapOverlay } from "@compendium/map-art";
import { serviceClient } from "../supabase";
import { SUPABASE_URL } from "../env";

const locatorFiles = import.meta.glob("./locators/*.json", { eager: true, import: "default" }) as Record<string, Locator>;
export interface MapBounds { x: number; y: number; w: number; h: number }
type BootstrapLayouts = Record<string, { name: string; parent: number; type: number; area?: number; bounds?: MapBounds; shape?: string; layer: MapLayout["layer"]; overlays: MapOverlay[] }>;
const layoutFiles = import.meta.glob("./layouts/*.json", { eager: true, import: "default" }) as Record<string, BootstrapLayouts>;

// Icon locators (D-0048) are big (every file under interface/icons/) and only
// needed when an icon is missing, so they load on demand.
const iconLocatorFiles = import.meta.glob("./icon-locators/*.json", { import: "default" }) as Record<string, () => Promise<Locator>>;

/** Layouts from the client's own tables for a flavor's newest build (D-0044). */
export function bootstrapLayouts(flavor: string): BootstrapLayouts {
  const mine = Object.entries(layoutFiles).filter(([path]) => path.includes(`/${flavor}-`)).sort(([a], [b]) => b.localeCompare(a));
  return mine[0]?.[1] ?? {};
}

/** The locator for a flavor: the newest build we have one for. */
export function locatorFor(flavor: string): Locator | undefined {
  const mine = Object.entries(locatorFiles).filter(([path]) => path.includes(`/${flavor}-`)).map(([, l]) => l);
  return mine.sort((a, b) => b.build - a.build)[0];
}

async function iconLocatorFor(flavor: string): Promise<Locator | undefined> {
  const mine = Object.entries(iconLocatorFiles).filter(([path]) => path.includes(`/${flavor}-`)).sort(([a], [b]) => b.localeCompare(a));
  return mine[0] ? mine[0][1]() : undefined;
}

export const BUCKET = "assets";
export const iconPath = (fdid: number) => `icons/${fdid}.png`;
export const mapArtPath = (flavor: string, mapId: number) => `maps/${flavor}/${mapId}.jpg`;
export const sourcePath = (flavor: string, fdid: number) => `source/${flavor}/${fdid}.blp`;
export const publicUrl = (path: string, version?: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}${version ? `?v=${version}` : ""}`;

/** Load a client file: our stored copy first, else the content servers (and keep a copy). */
async function loadFile(flavor: string, fdid: number, locator: Locator): Promise<Buffer> {
  const db = serviceClient();
  const path = sourcePath(flavor, fdid);
  const { data } = await db.storage.from(BUCKET).download(path);
  if (data) return Buffer.from(await data.arrayBuffer());
  const bytes = await fetchFromCdn(locator, fdid);
  await db.storage.from(BUCKET).upload(path, bytes, { contentType: "application/octet-stream", upsert: true });
  return bytes;
}

export interface PendingMap { mapId: number; layout: MapLayout; hash: string }

/**
 * Maps whose stored art is missing or built from an older layout. The layout
 * for a map is the bootstrap one (every map of the build, all pieces) merged
 * with whatever contributors' add-ons have recorded, so a map exists before
 * anyone visits it and follows the client if its art changes.
 */
export async function pendingMaps(flavor: string, limit = 500): Promise<PendingMap[]> {
  const db = serviceClient();
  const [{ data: facts }, { data: art }] = await Promise.all([
    db.from("facts").select("entity_id, field, value_json").eq("flavor", flavor).eq("entity_type", "map").in("field", ["art_layer", "art_overlay"]).limit(20000),
    db.from("artwork").select("entity_id, layout_hash").eq("flavor", flavor).eq("entity_type", "map").eq("kind", "map"),
  ]);
  const have = new Map((art ?? []).map((a) => [a.entity_id, a.layout_hash]));
  const byMap = new Map<number, MapLayout>();
  for (const [id, b] of Object.entries(bootstrapLayouts(flavor))) byMap.set(Number(id), { layer: b.layer, overlays: [...b.overlays] });
  for (const f of facts ?? []) {
    const l = byMap.get(f.entity_id) ?? byMap.set(f.entity_id, { layer: undefined as unknown as MapLayout["layer"], overlays: [] }).get(f.entity_id)!;
    if (f.field === "art_layer") { if (!l.layer) l.layer = f.value_json as MapLayout["layer"]; }
    else {
      const o = f.value_json as MapOverlay;
      if (!l.overlays.some((x) => x.t.join(",") === o.t.join(","))) l.overlays.push(o);
    }
  }
  const out: PendingMap[] = [];
  for (const [mapId, layout] of byMap) {
    if (!layout.layer) continue;
    const hash = layoutHash(layout);
    if (have.get(mapId) !== hash) out.push({ mapId, layout, hash });
    if (out.length >= limit) break;
  }
  return out;
}

export async function composeOne(flavor: string, p: PendingMap): Promise<{ mapId: number; pieces: number }> {
  const locator = locatorFor(flavor);
  if (!locator) throw new Error(`no locator for ${flavor}`);
  const db = serviceClient();
  // Fetch every file up front, eight at a time, so a map with thirty pieces is
  // one short burst instead of a chain of round trips inside the time budget.
  const ids = [...new Set([...p.layout.layer.t, ...p.layout.overlays.flatMap((o) => o.t)])];
  const files = new Map<number, Buffer>();
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (next < ids.length) { const id = ids[next++]!; files.set(id, await loadFile(flavor, id, locator)); } }));
  const canvas = await composeMap(p.layout, async (fdid) => files.get(fdid)!);
  const jpg = encodeJpeg(canvas);
  const path = mapArtPath(flavor, p.mapId);
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, jpg, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  const { error: rowErr } = await db.from("artwork").upsert(
    { flavor, entity_type: "map", entity_id: p.mapId, kind: "map", path, width: canvas.width, height: canvas.height, build: locator.build, layout_hash: p.hash, pieces: p.layout.overlays.length, updated_at: new Date().toISOString() },
    { onConflict: "flavor,entity_type,entity_id,kind" },
  );
  if (rowErr) throw new Error(`artwork row: ${rowErr.message}`);
  return { mapId: p.mapId, pieces: p.layout.overlays.length };
}

const inFlight = new Set<string>();

/**
 * Compose a map on first view when it is missing, so no one has to press a
 * button (D-0044). One map takes a few seconds; the page waits once, then the
 * stored image serves every later view. Failures leave the page without a map.
 */
export const lastMapArtError = new Map<string, string>();

export async function ensureMapArt(flavor: string, mapId: number): Promise<boolean> {
  const key = `${flavor}:${mapId}`;
  if (inFlight.has(key)) return false;
  if (!locatorFor(flavor)) { lastMapArtError.set(key, "no locator"); return false; }
  inFlight.add(key);
  const t0 = Date.now();
  try {
    const pending = (await pendingMaps(flavor)).find((p) => p.mapId === mapId);
    if (!pending) { lastMapArtError.set(key, "no layout pending"); return false; }
    await composeOne(flavor, pending);
    lastMapArtError.delete(key);
    return true;
  } catch (e) {
    lastMapArtError.set(key, `${String(e)} after ${Date.now() - t0}ms`);
    console.error(`map ${mapId}: ${String(e)}`);
    return false;
  } finally { inFlight.delete(key); }
}

const iconsInFlight = new Set<number>();

/**
 * Icons by client file id (D-0048): our stored PNG for each, made on first
 * view from the client's BLP like the maps. The same file id names the same
 * picture in every flavor, so icons are stored once, without a flavor. At most
 * `budget` missing icons are fetched per call, eight at a time; the rest come
 * on a later view. Returns fdid -> public URL for every icon we have.
 */
export async function ensureIcons(flavor: string, fdids: number[], budget = 48): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const ids = [...new Set(fdids.filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return out;
  const db = serviceClient();
  const { data: have } = await db.from("artwork").select("entity_id, path, layout_hash").eq("entity_type", "item").eq("kind", "icon").in("entity_id", ids);
  for (const a of have ?? []) out.set(a.entity_id, publicUrl(a.path, a.layout_hash));
  const missing = ids.filter((id) => !out.has(id) && !iconsInFlight.has(id)).slice(0, budget);
  if (!missing.length) return out;
  const locator = await iconLocatorFor(flavor);
  if (!locator) return out;
  for (const id of missing) iconsInFlight.add(id);
  try {
    let next = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (next < missing.length) {
        const fdid = missing[next++]!;
        try {
          if (!(fdid in locator.files)) continue;
          const png = encodePng(decodeBlp(await fetchFromCdn(locator, fdid)));
          const path = iconPath(fdid);
          const { error: upErr } = await db.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
          if (upErr) throw new Error(upErr.message);
          const hash = String(locator.build);
          const { error: rowErr } = await db.from("artwork").upsert(
            { flavor, entity_type: "item", entity_id: fdid, kind: "icon", path, width: 64, height: 64, build: locator.build, layout_hash: hash, pieces: 0, updated_at: new Date().toISOString() },
            { onConflict: "flavor,entity_type,entity_id,kind" },
          );
          if (rowErr) throw new Error(rowErr.message);
          out.set(fdid, publicUrl(path, hash));
        } catch (e) {
          console.error(`icon ${fdid}: ${String(e)}`);
        }
      }
    }));
  } finally {
    for (const id of missing) iconsInFlight.delete(id);
  }
  return out;
}
