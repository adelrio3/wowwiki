/**
 * HTTP contract between the sync core (browser or helper) and the site's
 * functions. Both sides import these types; the functions validate with zod.
 */
import { z } from "zod";
import { FlavorSchema } from "./savedvariables.js";

/** POST /api/sync/check */
export const SyncCheckRequestSchema = z.object({
  hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(64),
});
export const SyncCheckResponseSchema = z.object({
  /** hashes the server has never seen */
  missing: z.array(z.string()),
  /** hashes the server already has, with their upload status */
  known: z.record(z.string(), z.object({ uploadId: z.string(), status: z.string() })),
});

/** POST /api/sync/upload (multipart: file + JSON "meta") */
export const SyncUploadMetaSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().positive(),
  flavor: FlavorSchema,
  /** folder the file came from, e.g. "_classic_era_"; never the account folder name */
  flavorFolder: z.string(),
  identity: z.string(),
  accountToken: z.string().optional(),
  summary: z.object({
    schema: z.number().int(),
    addonVersion: z.string(),
    characters: z.array(
      z.object({ guid: z.string(), name: z.string(), realm: z.string(), flavor: FlavorSchema, sessions: z.number().int(), maxSeq: z.number().int(), acked: z.number().int() }),
    ),
  }),
});
export const SyncUploadResponseSchema = z.object({
  uploadId: z.string(),
  status: z.enum(["received", "ingesting", "ingested", "failed", "duplicate"]),
});

/** GET /api/sync/status?uploadId=... */
export const SyncStatusResponseSchema = z.object({
  uploadId: z.string(),
  status: z.enum(["received", "ingesting", "ingested", "failed"]),
  error: z.string().nullable().optional(),
  observations: z.number().int().optional(),
  /** highest ingested session seq per character GUID; written to the ack file */
  ack: z.record(z.string(), z.number().int()).default({}),
});

/** GET /api/addon/manifest.json */
export const AddonManifestSchema = z.object({
  name: z.literal("WoWCompendium"),
  version: z.string(),
  files: z.array(z.object({ path: z.string(), sha256: z.string(), size: z.number().int() })),
});
export type AddonManifest = z.infer<typeof AddonManifestSchema>;

export type SyncCheckRequest = z.infer<typeof SyncCheckRequestSchema>;
export type SyncCheckResponse = z.infer<typeof SyncCheckResponseSchema>;
export type SyncUploadMeta = z.infer<typeof SyncUploadMetaSchema>;
export type SyncUploadResponse = z.infer<typeof SyncUploadResponseSchema>;
export type SyncStatusResponse = z.infer<typeof SyncStatusResponseSchema>;
