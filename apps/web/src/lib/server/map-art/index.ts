/**
 * Zone map assembly (D-0041). Reads a map's layout facts (recorded by the
 * add-on as a client catalog), fetches each client file once from Blizzard's
 * content servers, keeps a copy of every source file in our bucket, composes
 * the finished map, and stores it with a row in `artwork`. Pure JavaScript;
 * runs inside the site's own serverless function.
 */
import { composeMap, encodeJpeg, fetchFromCdn, layoutHash, type Locator, type MapLayout, type MapOverlay } from "@compendium/map-art";
import { serviceClient } from "../supabase";
import { SUPABASE_URL } from "../env";

const locatorFiles = import.meta.glob("./locators/*.json", { eager: true, import: "default" }) as Record<string, Locator>;

/** The locator for a flavor: the newest build we have one for. */
export function locatorFor(flavor: string): Locator | undefined {
  const mine = Object.entries(locatorFiles).filter(([path]) => path.includes(`/${flavor}-`)).map(([, l]) => l);
  return mine.sort((a, b) => b.build - a.build)[0];
}

export const BUCKET = "assets";
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

/** Maps whose stored art is missing or built from an older layout. */
export async function pendingMaps(flavor: string, limit = 500): Promise<PendingMap[]> {
  const db = serviceClient();
  const [{ data: facts }, { data: art }] = await Promise.all([
    db.from("facts").select("entity_id, field, value_json").eq("flavor", flavor).eq("entity_type", "map").in("field", ["art_layer", "art_overlay"]).limit(20000),
    db.from("artwork").select("entity_id, layout_hash").eq("flavor", flavor).eq("entity_type", "map").eq("kind", "map"),
  ]);
  const have = new Map((art ?? []).map((a) => [a.entity_id, a.layout_hash]));
  const byMap = new Map<number, MapLayout>();
  for (const f of facts ?? []) {
    const l = byMap.get(f.entity_id) ?? byMap.set(f.entity_id, { layer: undefined as unknown as MapLayout["layer"], overlays: [] }).get(f.entity_id)!;
    if (f.field === "art_layer") l.layer = f.value_json as MapLayout["layer"];
    else l.overlays.push(f.value_json as MapOverlay);
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
  const canvas = await composeMap(p.layout, (fdid) => loadFile(flavor, fdid, locator));
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
