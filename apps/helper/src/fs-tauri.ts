/**
 * sync-core file adapter over Tauri's fs plugin. The root is the World of
 * Warcraft folder the user chose; sync-core paths are relative to it with
 * forward slashes.
 */
import { exists, mkdir, readDir, readFile, readTextFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { DirEntry, FileSystemAdapter } from "@compendium/sync-core";

export class TauriFileSystem implements FileSystemAdapter {
  readonly rootName: string;
  constructor(private readonly root: string) {
    this.rootName = root.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? root;
  }
  abs(path: string): string {
    const rel = path.split("/").filter(Boolean).join("\\");
    return rel ? `${this.root.replace(/[\\/]+$/, "")}\\${rel}` : this.root;
  }
  async list(dir: string): Promise<DirEntry[]> {
    const entries = await readDir(this.abs(dir));
    return entries.map((e) => ({ name: e.name, kind: e.isDirectory ? "directory" : "file" }));
  }
  exists(path: string): Promise<boolean> { return exists(this.abs(path)); }
  readBytes(path: string): Promise<Uint8Array> { return readFile(this.abs(path)); }
  readText(path: string): Promise<string> { return readTextFile(this.abs(path)); }
  writeBytes(path: string, bytes: Uint8Array): Promise<void> { return writeFile(this.abs(path), bytes); }
  writeText(path: string, text: string): Promise<void> { return writeTextFile(this.abs(path), text); }
  async mkdir(path: string): Promise<void> { if (!(await this.exists(path))) await mkdir(this.abs(path), { recursive: true }); }
  remove(path: string, options?: { recursive?: boolean }): Promise<void> { return remove(this.abs(path), { recursive: options?.recursive ?? false }); }
}
