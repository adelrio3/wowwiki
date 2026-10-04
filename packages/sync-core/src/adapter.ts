/**
 * The one interface the sync protocol needs from a file system. Paths are
 * "/"-separated and relative to the chosen World of Warcraft root folder.
 * Implementations: browser (File System Access API), node (helper), memory
 * (tests).
 */
export interface DirEntry {
  name: string;
  kind: "file" | "directory";
}

export interface FileSystemAdapter {
  /** Name of the root folder, when known (e.g. "World of Warcraft" or "_classic_era_"). */
  readonly rootName?: string;
  list(dir: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
  readBytes(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  writeText(path: string, text: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter((p) => p !== "")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
