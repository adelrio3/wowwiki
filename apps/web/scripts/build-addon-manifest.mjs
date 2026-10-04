// Copies the add-on into static/addon/<version>/ and writes static/addon/manifest.json.
// Runs before every site build so the site always serves the add-on in the repo.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const addonDir = join(here, "..", "..", "..", "addon", "WoWCompendium");
const outRoot = join(here, "..", "static", "addon");

const toc = readFileSync(join(addonDir, "WoWCompendium_Vanilla.toc"), "utf8");
const version = /^## Version:\s*(.+)$/m.exec(toc)?.[1]?.trim();
if (!version) throw new Error("no version in TOC");

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const rel = relative(addonDir, full).split("\\").join("/");
      if (rel.startsWith("results/") || rel.endsWith(".md")) continue;
      const bytes = readFileSync(full);
      files.push({ path: rel, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length });
    }
  }
}
walk(addonDir);
files.sort((a, b) => a.path.localeCompare(b.path));

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(join(outRoot, version), { recursive: true });
for (const f of files) {
  mkdirSync(dirname(join(outRoot, version, f.path)), { recursive: true });
  cpSync(join(addonDir, f.path), join(outRoot, version, f.path));
}
writeFileSync(join(outRoot, "manifest.json"), JSON.stringify({ name: "WoWCompendium", version, files }, null, 2));
console.log(`addon ${version}: ${files.length} files`);
