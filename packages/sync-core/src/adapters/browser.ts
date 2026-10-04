/**
 * File System Access API adapter (Chromium). The root is the directory handle
 * the user picked; paths are resolved by walking handles.
 */
import type { DirEntry, FileSystemAdapter } from "../adapter.js";

type DirHandle = FileSystemDirectoryHandle;

export class BrowserFileSystem implements FileSystemAdapter {
  readonly rootName: string;

  constructor(private readonly root: DirHandle) {
    this.rootName = root.name;
  }

  private parts(path: string): string[] {
    return path.split("/").filter((p) => p !== "");
  }

  private async dir(path: string, create = false): Promise<DirHandle> {
    let h = this.root;
    for (const part of this.parts(path)) h = await h.getDirectoryHandle(part, { create });
    return h;
  }

  private async file(path: string, create = false): Promise<FileSystemFileHandle> {
    const parts = this.parts(path);
    const name = parts.pop();
    if (!name) throw new Error("file path required");
    const d = await this.dir(parts.join("/"), create);
    return d.getFileHandle(name, { create });
  }

  async list(path: string): Promise<DirEntry[]> {
    const d = await this.dir(path);
    const out: DirEntry[] = [];
    // `entries()` is the async iterator on directory handles.
    for await (const [name, handle] of (d as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      out.push({ name, kind: handle.kind });
    }
    return out;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.dir(path);
      return true;
    } catch {
      try {
        await this.file(path);
        return true;
      } catch {
        return false;
      }
    }
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const f = await (await this.file(path)).getFile();
    return new Uint8Array(await f.arrayBuffer());
  }

  async readText(path: string): Promise<string> {
    const f = await (await this.file(path)).getFile();
    return f.text();
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const h = await this.file(path, true);
    const w = await h.createWritable();
    await w.write(bytes as BufferSource);
    await w.close();
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, new TextEncoder().encode(text));
  }

  async mkdir(path: string): Promise<void> {
    await this.dir(path, true);
  }

  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parts = this.parts(path);
    const name = parts.pop();
    if (!name) throw new Error("cannot remove root");
    const parent = await this.dir(parts.join("/"));
    await parent.removeEntry(name, { recursive: options?.recursive ?? false });
  }
}

/** Ask the user for the WoW folder. Must be called from a user gesture. */
export async function pickWowFolder(): Promise<BrowserFileSystem> {
  const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  if (!picker) throw new Error("This browser cannot access folders. Use Chrome, Edge, or Brave, or install the helper.");
  const handle = await picker({ mode: "readwrite", id: "wow-root" });
  return new BrowserFileSystem(handle);
}

export async function ensurePermission(handle: DirHandle): Promise<"granted" | "prompt" | "denied"> {
  const h = handle as unknown as {
    queryPermission(o: { mode: string }): Promise<PermissionState>;
    requestPermission(o: { mode: string }): Promise<PermissionState>;
  };
  const q = await h.queryPermission({ mode: "readwrite" });
  if (q === "granted") return "granted";
  const r = await h.requestPermission({ mode: "readwrite" });
  return r === "granted" ? "granted" : r === "prompt" ? "prompt" : "denied";
}
