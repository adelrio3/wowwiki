/**
 * A locator says where each client file lives on Blizzard's content servers
 * for one build: which archive, at what offset, how many bytes. Built offline
 * by tools/assets from the archive indexes (N-0020) so that a server with
 * seconds of time can fetch a file with one ranged request.
 */
import { blteDecode } from "./blte.js";

export interface Locator {
  product: string;
  build: number;
  version: string;
  cdnHost: string;
  cdnPath: string;
  /** fdid -> [archiveHash, offset, size] */
  files: Record<string, [string, number, number]>;
}

export function locatorHas(l: Locator, fdid: number): boolean {
  return fdid in l.files;
}

/** Fetch one file straight from the content servers and decode its container. */
export async function fetchFromCdn(l: Locator, fdid: number, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const entry = l.files[fdid];
  if (!entry) throw new Error(`file ${fdid} not in locator for build ${l.build}`);
  const [hash, offset, size] = entry;
  const url = `https://${l.cdnHost}/${l.cdnPath}/data/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;
  // Connection-level failures happen now and then from serverless hosts; three tries cover them.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { Range: `bytes=${offset}-${offset + size - 1}` } });
      if (res.status === 404 || res.status === 416) throw new Error(`cdn ${res.status} for ${fdid}`);
      if (!res.ok) throw Object.assign(new Error(`cdn ${res.status} for ${fdid}`), { retry: true });
      return blteDecode(Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      lastError = e;
      if ((e as { retry?: boolean }).retry === false || /cdn 40[46]/.test(String(e))) break;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
