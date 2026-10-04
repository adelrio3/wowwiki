/** In-memory file system for tests. */
import type { DirEntry, FileSystemAdapter } from "../adapter.js";

export class MemoryFileSystem implements FileSystemAdapter {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>([""]);

  constructor(public readonly rootName?: string) {}

  private norm(p: string): string {
    return p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  }

  async list(dir: string): Promise<DirEntry[]> {
    const d = this.norm(dir);
    const prefix = d === "" ? "" : d + "/";
    const names = new Map<string, DirEntry["kind"]>();
    for (const f of this.files.keys()) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      const first = rest.split("/")[0]!;
      if (!rest.includes("/")) names.set(first, "file");
      else if (!names.has(first)) names.set(first, "directory");
    }
    for (const dd of this.dirs) {
      if (dd === "" || !dd.startsWith(prefix) || dd === d) continue;
      const rest = dd.slice(prefix.length);
      const first = rest.split("/")[0]!;
      names.set(first, "directory");
    }
    return [...names.entries()].map(([name, kind]) => ({ name, kind }));
  }

  async exists(path: string): Promise<boolean> {
    const p = this.norm(path);
    return this.files.has(p) || this.dirs.has(p);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const b = this.files.get(this.norm(path));
    if (!b) throw new Error(`no such file: ${path}`);
    return b;
  }

  async readText(path: string): Promise<string> {
    return new TextDecoder().decode(await this.readBytes(path));
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const p = this.norm(path);
    const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    if (!this.dirs.has(parent)) throw new Error(`no such directory: ${parent}`);
    this.files.set(p, bytes);
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, new TextEncoder().encode(text));
  }

  async mkdir(path: string): Promise<void> {
    const p = this.norm(path);
    const parts = p.split("/");
    for (let i = 1; i <= parts.length; i++) this.dirs.add(parts.slice(0, i).join("/"));
  }

  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    const p = this.norm(path);
    if (this.files.has(p)) {
      this.files.delete(p);
      return;
    }
    if (!this.dirs.has(p)) return;
    if (!options?.recursive) throw new Error("directory not empty");
    for (const f of [...this.files.keys()]) if (f === p || f.startsWith(p + "/")) this.files.delete(f);
    for (const d of [...this.dirs]) if (d === p || d.startsWith(p + "/")) this.dirs.delete(d);
  }

  /** test helper */
  async seed(path: string, text: string): Promise<void> {
    const p = this.norm(path);
    const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    await this.mkdir(parent);
    await this.writeText(p, text);
  }
}
