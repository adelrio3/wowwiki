/**
 * Minimal reader for Blizzard's content delivery (TACT/CASC) as used by the
 * World of Warcraft clients. Enough to fetch a file by its FileDataID:
 *   versions -> build config + CDN config -> encoding (CKey -> EKey)
 *   -> root (FileDataID -> CKey) -> archive-group index (EKey -> archive, offset)
 *   -> ranged GET from the archive -> BLTE decode.
 * Read-only, public endpoints, no authentication. See docs/11 N-0020.
 */
import { inflateSync } from "node:zlib";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Product = "wow_classic_era" | "wow_classic" | "wow" | "wow_classic_titan";

const CACHE = process.env.TACT_CACHE ?? join(process.cwd(), ".tact-cache");

function hexPath(hash: string): string {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;
}

async function fetchBytes(url: string, range?: { offset: number; size: number }): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (range) headers.Range = `bytes=${range.offset}-${range.offset + range.size - 1}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 404) throw new Error(`404 ${url}`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw new Error(`failed to fetch ${url}`);
}

async function cached(name: string, load: () => Promise<Buffer>): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const p = join(CACHE, name);
  if (existsSync(p)) return readFileSync(p);
  const b = await load();
  writeFileSync(p, b);
  return b;
}

/** Parse the pipe-separated tables served by version.battle.net. */
function parseTable(text: string): Array<Record<string, string>> {
  const lines = text.split("\n").filter((l) => l && !l.startsWith("##"));
  const cols = lines[0]!.split("|").map((c) => c.split("!")[0]!);
  return lines.slice(1).map((l) => Object.fromEntries(l.split("|").map((v, i) => [cols[i]!, v])));
}

function parseConfig(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [k, v] = line.split(" = ");
    if (k && v !== undefined) out[k.trim()] = v.trim().split(" ");
  }
  return out;
}

/** Decode a BLTE container into the plain file bytes. */
export function blteDecode(buf: Buffer): Buffer {
  if (buf.toString("ascii", 0, 4) !== "BLTE") throw new Error("not BLTE");
  const headerSize = buf.readUInt32BE(4);
  const chunks: Array<{ csize: number; dsize: number }> = [];
  let pos = 8;
  if (headerSize === 0) {
    chunks.push({ csize: buf.length - 8, dsize: 0 });
  } else {
    const flags = buf.readUInt8(8);
    const count = (buf.readUInt8(9) << 16) | (buf.readUInt8(10) << 8) | buf.readUInt8(11);
    if (flags !== 0x0f && flags !== 0x10) throw new Error(`unexpected BLTE flags ${flags}`);
    pos = 12;
    for (let i = 0; i < count; i++) {
      chunks.push({ csize: buf.readUInt32BE(pos), dsize: buf.readUInt32BE(pos + 4) });
      pos += 24; // csize, dsize, 16-byte checksum
    }
    pos = headerSize;
  }
  const parts: Buffer[] = [];
  for (const c of chunks) {
    const mode = String.fromCharCode(buf[pos]!);
    const body = buf.subarray(pos + 1, pos + c.csize);
    if (mode === "N") parts.push(Buffer.from(body));
    else if (mode === "Z") parts.push(inflateSync(body));
    else if (mode === "E") throw new Error("encrypted chunk (needs TACT key)");
    else throw new Error(`unknown BLTE chunk mode ${mode}`);
    pos += c.csize;
  }
  return Buffer.concat(parts);
}

export interface Build {
  product: Product;
  version: string;
  buildId: number;
  cdnHost: string;
  cdnPath: string;
  buildConfig: Record<string, string[]>;
  cdnConfig: Record<string, string[]>;
}

export async function loadBuild(product: Product, region = "us"): Promise<Build> {
  const versions = parseTable(await (await fetch(`https://${region}.version.battle.net/${product}/versions`)).text());
  const cdns = parseTable(await (await fetch(`https://${region}.version.battle.net/${product}/cdns`)).text());
  const v = versions.find((r) => r.Region === region) ?? versions[0]!;
  const c = cdns.find((r) => r.Name === region) ?? cdns[0]!;
  const cdnHost = c.Hosts!.split(" ")[0]!;
  const cdnPath = c.Path!;
  const base = `https://${cdnHost}/${cdnPath}`;
  const buildConfig = parseConfig((await cached(`config-${v.BuildConfig}`, () => fetchBytes(`${base}/config/${hexPath(v.BuildConfig!)}`))).toString());
  const cdnConfig = parseConfig((await cached(`config-${v.CDNConfig}`, () => fetchBytes(`${base}/config/${hexPath(v.CDNConfig!)}`))).toString());
  return { product, version: v.VersionsName!, buildId: Number(v.BuildId), cdnHost, cdnPath, buildConfig, cdnConfig };
}

/** Encoding table: content key -> encoded key (first one). */
export class Encoding {
  private map = new Map<string, string>();
  static async load(b: Build): Promise<Encoding> {
    const [ckey, ekey] = b.buildConfig.encoding!;
    const raw = await cached(`encoding-${ekey}`, () => fetchBytes(`https://${b.cdnHost}/${b.cdnPath}/data/${hexPath(ekey!)}`));
    const buf = blteDecode(raw);
    if (buf.toString("ascii", 0, 2) !== "EN") throw new Error("bad encoding header");
    const ckeySize = buf.readUInt8(3), ekeySize = buf.readUInt8(4);
    const cPageKb = buf.readUInt16BE(5);
    const cPageCount = buf.readUInt32BE(9);
    const especBlockSize = buf.readUInt32BE(18);
    const enc = new Encoding();
    let pos = 22 + especBlockSize + cPageCount * (ckeySize + 16); // skip espec strings and page index
    const pageSize = cPageKb * 1024;
    for (let p = 0; p < cPageCount; p++) {
      const start = pos + p * pageSize;
      let q = start;
      while (q + 6 + ckeySize <= start + pageSize) {
        const keyCount = buf.readUInt8(q);
        if (keyCount === 0) break;
        const c = buf.toString("hex", q + 6, q + 6 + ckeySize);
        const e = buf.toString("hex", q + 6 + ckeySize, q + 6 + ckeySize + ekeySize);
        enc.map.set(c, e);
        q += 6 + ckeySize + keyCount * ekeySize;
      }
    }
    void ckey;
    return enc;
  }
  ekey(ckey: string): string | undefined { return this.map.get(ckey); }
  get size() { return this.map.size; }
}

/** Root: FileDataID -> content key, for the enUS locale (or any when unflagged). */
export class Root {
  private map = new Map<number, string>();
  static async load(b: Build, enc: Encoding, localeFlag = 0x2 /* enUS */): Promise<Root> {
    const ckey = b.buildConfig.root![0]!;
    const ekey = enc.ekey(ckey);
    if (!ekey) throw new Error("root ekey not in encoding");
    const raw = await cached(`root-${ekey}`, () => fetchBytes(`https://${b.cdnHost}/${b.cdnPath}/data/${hexPath(ekey)}`));
    const buf = blteDecode(raw);
    const root = new Root();
    let pos = 0, version = 0, totalFiles = 0, namedFiles = 0;
    if (buf.toString("ascii", 0, 4) === "TSFM") {
      const a = buf.readUInt32LE(4), c = buf.readUInt32LE(8);
      if (a <= 0x40 && c <= 10) { pos = a; version = c; totalFiles = buf.readUInt32LE(12); namedFiles = buf.readUInt32LE(16); }
      else { version = 1; totalFiles = a; namedFiles = c; pos = 12; }
    }
    const allNamed = totalFiles === namedFiles;
    while (pos + 12 <= buf.length) {
      const count = buf.readUInt32LE(pos);
      let contentFlags: number, localeFlags: number;
      if (version >= 2) {
        // v2 (10.1.7+): records, localeFlags, then content flags split over 4 + 4 + 1 bytes (N-0020)
        localeFlags = buf.readUInt32LE(pos + 4);
        contentFlags = buf.readUInt32LE(pos + 8);
        pos += 17;
      } else {
        contentFlags = buf.readUInt32LE(pos + 4);
        localeFlags = buf.readUInt32LE(pos + 8);
        pos += 12;
      }
      const fdids: number[] = [];
      let fdid = -1;
      for (let i = 0; i < count; i++) { fdid += buf.readInt32LE(pos) + 1; fdids.push(fdid); pos += 4; }
      const take = (localeFlags & localeFlag) !== 0 || localeFlags === 0xffffffff;
      for (let i = 0; i < count; i++) {
        if (take && !root.map.has(fdids[i]!)) root.map.set(fdids[i]!, buf.toString("hex", pos, pos + 16));
        pos += 16;
      }
      const hasNames = version === 0 || allNamed || (contentFlags & 0x10000000) === 0;
      if (hasNames) pos += 8 * count;
    }
    return root;
  }
  ckey(fdid: number): string | undefined { return this.map.get(fdid); }
  get size() { return this.map.size; }
}

/**
 * Archive indexes. The CDN does not publish the merged "archive-group" index
 * (403), so every archive's own .index is fetched once and cached. Each index is
 * sorted by encoded key in 4 KiB blocks with a table of each block's last key,
 * so lookups binary-search the table and scan one block (N-0020).
 */
export class ArchiveIndex {
  private indexes: Array<{ hash: string; buf: Buffer; lastKeys: string[]; perBlock: number; entrySize: number; keyBytes: number; count: number }> = [];
  static async load(b: Build, concurrency = 24, onProgress?: (done: number, total: number) => void): Promise<ArchiveIndex> {
    const idx = new ArchiveIndex();
    const hashes = b.cdnConfig.archives!;
    let next = 0, done = 0;
    const worker = async () => {
      while (next < hashes.length) {
        const i = next++;
        const hash = hashes[i]!;
        const buf = await cached(`index-${hash}`, () => fetchBytes(`https://${b.cdnHost}/${b.cdnPath}/data/${hexPath(hash)}.index`));
        idx.indexes[i] = ArchiveIndex.parse(hash, buf);
        onProgress?.(++done, hashes.length);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return idx;
  }
  private static parse(hash: string, buf: Buffer) {
    const f = buf.length - 28;
    const blockKb = buf.readUInt8(f + 11), offsetBytes = buf.readUInt8(f + 12), sizeBytes = buf.readUInt8(f + 13), keyBytes = buf.readUInt8(f + 14);
    const count = buf.readUInt32LE(f + 16);
    const blockSize = blockKb * 1024, entrySize = keyBytes + sizeBytes + offsetBytes, perBlock = Math.floor(blockSize / entrySize);
    const blocks = Math.ceil(count / perBlock);
    const lastKeys: string[] = [];
    const toc = blocks * blockSize;
    for (let i = 0; i < blocks; i++) lastKeys.push(buf.toString("hex", toc + i * keyBytes, toc + (i + 1) * keyBytes));
    return { hash, buf, lastKeys, perBlock, entrySize, keyBytes, count };
  }
  locate(ekey: string): { hash: string; offset: number; size: number } | undefined {
    for (const ix of this.indexes) {
      // first block whose last key >= ekey
      let lo = 0, hi = ix.lastKeys.length - 1, block = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (ix.lastKeys[mid]! >= ekey) { block = mid; hi = mid - 1; } else lo = mid + 1; }
      if (block < 0) continue;
      const blockSize = ix.perBlock * ix.entrySize;
      const start = block * 4096;
      const n = Math.min(ix.perBlock, ix.count - block * ix.perBlock);
      for (let i = 0; i < n; i++) {
        const p = start + i * ix.entrySize;
        const k = ix.buf.toString("hex", p, p + ix.keyBytes);
        if (k === ekey) return { hash: ix.hash, size: ix.buf.readUInt32BE(p + ix.keyBytes), offset: ix.buf.readUInt32BE(p + ix.keyBytes + 4) };
        if (k > ekey) break;
      }
      void blockSize;
    }
    return undefined;
  }
  get size() { return this.indexes.reduce((n, i) => n + i.count, 0); }
}

export class Casc {
  private constructor(public build: Build, private enc: Encoding, private root: Root, private index: ArchiveIndex) {}
  static async open(product: Product, onProgress?: (done: number, total: number) => void): Promise<Casc> {
    const build = await loadBuild(product);
    const enc = await Encoding.load(build);
    const root = await Root.load(build, enc);
    const index = await ArchiveIndex.load(build, 24, onProgress);
    return new Casc(build, enc, root, index);
  }
  async file(fdid: number): Promise<Buffer> {
    const ckey = this.root.ckey(fdid);
    if (!ckey) throw new Error(`FileDataID ${fdid} not in root`);
    const ekey = this.enc.ekey(ckey);
    if (!ekey) throw new Error(`no encoding for ${fdid}`);
    const loc = this.index.locate(ekey);
    if (!loc) throw new Error(`FileDataID ${fdid} not in any archive`);
    const raw = await fetchBytes(`https://${this.build.cdnHost}/${this.build.cdnPath}/data/${hexPath(loc.hash)}`, { offset: loc.offset, size: loc.size });
    return blteDecode(raw);
  }
  stats() { return { encoding: this.enc.size, root: this.root.size, index: this.index.size }; }
}
