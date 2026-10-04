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

if (cmd === "locator") {
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
  console.error("usage: cli.ts locator [--product wow_classic_era] [--flavor era] [--prefix interface/worldmap/] [--out file]");
  process.exit(2);
}
