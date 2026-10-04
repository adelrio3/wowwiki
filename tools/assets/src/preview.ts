// Local check: compose one map from the bootstrap layout with the full content client.
import { writeFileSync } from "node:fs";
import { composeMap, encodeJpeg } from "@compendium/map-art";
import { Casc } from "./tact.js";
const [mapId = "1412", out = "/tmp/claude-0/-home-user-wowwiki/86a64ee4-0607-5687-b424-652937e851aa/scratchpad/preview.jpg"] = process.argv.slice(2);
const layouts = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(new URL("../../../apps/web/src/lib/server/map-art/layouts/era-70003.json", import.meta.url), "utf8")));
const l = layouts[mapId];
if (!l) throw new Error(`no layout for ${mapId}`);
const casc = await Casc.open("wow_classic_era");
const canvas = await composeMap({ layer: l.layer, overlays: l.overlays }, (fdid) => casc.file(fdid));
writeFileSync(out, encodeJpeg(canvas));
console.log(`${l.name}: ${canvas.width}x${canvas.height}, ${l.overlays.length} pieces -> ${out}`);
