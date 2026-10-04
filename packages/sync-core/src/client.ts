/**
 * HTTP client for the site's sync endpoints. The browser relies on its session
 * cookie; the helper passes a device token.
 */
import {
  SyncCheckResponseSchema,
  SyncStatusResponseSchema,
  SyncUploadResponseSchema,
  AddonManifestSchema,
  type AddonManifest,
  type SyncCheckResponse,
  type SyncStatusResponse,
  type SyncUploadMeta,
  type SyncUploadResponse,
} from "@compendium/schema";

export interface SyncClient {
  manifest(): Promise<AddonManifest>;
  addonFile(version: string, path: string): Promise<Uint8Array>;
  check(hashes: string[]): Promise<SyncCheckResponse>;
  upload(bytes: Uint8Array, meta: SyncUploadMeta): Promise<SyncUploadResponse>;
  status(uploadId: string): Promise<SyncStatusResponse>;
}

export interface HttpSyncClientOptions {
  baseUrl: string;
  deviceToken?: string;
  fetch?: typeof fetch;
}

export class HttpSyncClient implements SyncClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly token: string | undefined;

  constructor(options: HttpSyncClientOptions) {
    this.base = options.baseUrl.replace(/\/$/, "");
    this.fetchFn = options.fetch ?? fetch;
    this.token = options.deviceToken;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this.token) h["authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private async json<T>(path: string, init: RequestInit, schema: { parse: (v: unknown) => T }): Promise<T> {
    const res = await this.fetchFn(this.base + path, { credentials: "include", ...init, headers: this.headers((init.headers as Record<string, string>) ?? {}) });
    if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return schema.parse(await res.json());
  }

  manifest(): Promise<AddonManifest> {
    return this.json("/addon/manifest.json", { method: "GET" }, AddonManifestSchema);
  }

  async addonFile(version: string, path: string): Promise<Uint8Array> {
    const res = await this.fetchFn(`${this.base}/addon/${encodeURIComponent(version)}/${path}`);
    if (!res.ok) throw new Error(`addon file ${path} failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  check(hashes: string[]): Promise<SyncCheckResponse> {
    return this.json(
      "/api/sync/check",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hashes }) },
      SyncCheckResponseSchema,
    );
  }

  upload(bytes: Uint8Array, meta: SyncUploadMeta): Promise<SyncUploadResponse> {
    const form = new FormData();
    form.set("meta", JSON.stringify(meta));
    form.set("file", new Blob([bytes as BlobPart], { type: "text/x-lua" }), "WoWCompendium.lua");
    return this.json("/api/sync/upload", { method: "POST", body: form }, SyncUploadResponseSchema);
  }

  status(uploadId: string): Promise<SyncStatusResponse> {
    return this.json(`/api/sync/status?uploadId=${encodeURIComponent(uploadId)}`, { method: "GET" }, SyncStatusResponseSchema);
  }
}
