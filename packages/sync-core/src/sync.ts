/**
 * The sync protocol (docs/04 "Reading and uploading"), independent of where
 * it runs. Both the browser page and the helper call runSync().
 */
import { parseSavedVariables } from "@compendium/lua-parser";
import { parseSavedVariablesDocument, summarize, type SavedVariables } from "@compendium/schema";
import { sha256Hex, type FileSystemAdapter } from "./adapter.js";
import { readAckFile, writeAckFile } from "./addon.js";
import type { SyncClient } from "./client.js";
import { detectLayout, findSavedVariables, type FlavorFolder, type SavedVariablesLocation } from "./layout.js";

export type SyncPhase =
  | "scanning"
  | "reading"
  | "checking"
  | "uploading"
  | "ingesting"
  | "acking"
  | "done"
  | "skipped"
  | "failed";

export interface SyncProgress {
  file: SavedVariablesLocation;
  phase: SyncPhase;
  uploadId?: string;
  message?: string;
}

export interface SyncFileResult {
  file: SavedVariablesLocation;
  sha256: string;
  outcome: "uploaded" | "already_synced" | "failed" | "not_linked" | "unparseable";
  uploadId?: string;
  error?: string;
  ack?: Record<string, number>;
  characters?: number;
}

export interface SyncReport {
  layoutKind: "root" | "flavor" | "unknown";
  results: SyncFileResult[];
}

export interface RunSyncOptions {
  onProgress?: (p: SyncProgress) => void;
  /** polling interval for ingest status, ms */
  pollMs?: number;
  /** give up waiting for ingest after this many ms; the ack is written on a later sync */
  pollTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** only these flavor folders (default all found) */
  only?: FlavorFolder[];
}

export interface ReadResult {
  bytes: Uint8Array;
  text: string;
  sha256: string;
  sv: SavedVariables;
}

/** Read, hash, parse, and validate one SavedVariables file. */
export async function readSavedVariables(fs: FileSystemAdapter, path: string): Promise<ReadResult> {
  const bytes = await fs.readBytes(path);
  const text = new TextDecoder("utf-8").decode(bytes);
  const sha256 = await sha256Hex(bytes);
  const doc = parseSavedVariables(text);
  const sv = parseSavedVariablesDocument(doc);
  return { bytes, text, sha256, sv };
}

export async function runSync(fs: FileSystemAdapter, client: SyncClient, options: RunSyncOptions = {}): Promise<SyncReport> {
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const pollMs = options.pollMs ?? 2000;
  const pollTimeoutMs = options.pollTimeoutMs ?? 120_000;
  const progress = options.onProgress ?? (() => {});

  const layout = await detectLayout(fs);
  const folders = options.only ?? layout.flavors;
  const results: SyncFileResult[] = [];

  for (const folder of folders) {
    const files = await findSavedVariables(fs, folder);
    for (const file of files) {
      progress({ file, phase: "reading" });
      let read: ReadResult;
      try {
        read = await readSavedVariables(fs, file.path);
      } catch (e) {
        results.push({ file, sha256: "", outcome: "unparseable", error: String(e) });
        progress({ file, phase: "failed", message: String(e) });
        continue;
      }
      const summary = summarize(read.sv);

      progress({ file, phase: "checking" });
      const check = await client.check([read.sha256]);
      let uploadId: string | undefined;
      if (check.known[read.sha256]) {
        const known = check.known[read.sha256]!;
        uploadId = known.uploadId;
        if (known.status === "ingested") {
          // Already done; still refresh the ack in case it was never written.
          const status = await client.status(uploadId);
          await mergeAck(fs, folder, status.ack);
          results.push({ file, sha256: read.sha256, outcome: "already_synced", uploadId, ack: status.ack, characters: summary.characters.length });
          progress({ file, phase: "skipped", uploadId });
          continue;
        }
      } else {
        progress({ file, phase: "uploading" });
        const res = await client.upload(read.bytes, {
          sha256: read.sha256,
          byteSize: read.bytes.byteLength,
          flavor: folder.flavor,
          flavorFolder: folder.folder,
          identity: read.sv.identity,
          accountToken: read.sv.link?.accountToken,
          summary: { schema: summary.schema, addonVersion: summary.addonVersion, characters: summary.characters },
        });
        uploadId = res.uploadId;
        if (res.status === "failed") {
          results.push({ file, sha256: read.sha256, outcome: "failed", uploadId, error: "upload rejected" });
          progress({ file, phase: "failed", uploadId });
          continue;
        }
      }

      progress({ file, phase: "ingesting", uploadId });
      const deadline = Date.now() + pollTimeoutMs;
      let final: Awaited<ReturnType<SyncClient["status"]>> | undefined;
      for (;;) {
        const status = await client.status(uploadId);
        if (status.status === "ingested" || status.status === "failed") {
          final = status;
          break;
        }
        if (Date.now() >= deadline) break;
        await sleep(pollMs);
      }
      if (!final) {
        results.push({ file, sha256: read.sha256, outcome: "uploaded", uploadId, characters: summary.characters.length, error: "ingest still running; ack on next sync" });
        progress({ file, phase: "done", uploadId, message: "ingest still running" });
        continue;
      }
      if (final.status === "failed") {
        results.push({ file, sha256: read.sha256, outcome: "failed", uploadId, error: final.error ?? "ingest failed" });
        progress({ file, phase: "failed", uploadId, message: final.error ?? undefined });
        continue;
      }
      progress({ file, phase: "acking", uploadId });
      await mergeAck(fs, folder, final.ack);
      results.push({ file, sha256: read.sha256, outcome: "uploaded", uploadId, ack: final.ack, characters: summary.characters.length });
      progress({ file, phase: "done", uploadId });
    }
  }
  return { layoutKind: layout.kind, results };
}

/** Never lower an ack value; the add-on prunes by it. */
async function mergeAck(fs: FileSystemAdapter, folder: FlavorFolder, ack: Record<string, number>): Promise<void> {
  const current = await readAckFile(fs, folder);
  let changed = false;
  for (const [guid, seq] of Object.entries(ack)) {
    if ((current[guid] ?? -1) < seq) {
      current[guid] = seq;
      changed = true;
    }
  }
  if (changed) await writeAckFile(fs, folder, current);
}
