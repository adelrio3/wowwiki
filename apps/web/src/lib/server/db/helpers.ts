/** Helpers (desktop devices) signed in to an account, with the state they last reported. */
import { serviceClient } from "../supabase";
import { MOCK } from "./mock";

export interface HelperClient { folder: string; flavor: string; installed: boolean; version: string | null; linked: boolean; needsUpdate: boolean }
export interface HelperState {
  folder?: string | null;
  clients?: HelperClient[];
  lastSync?: string | null;
  lastError?: string | null;
  paused?: boolean;
  gameRunning?: boolean;
  status?: string;
}
export interface HelperDevice {
  id: string;
  name: string;
  helperVersion: string | null;
  state: HelperState;
  lastSeenAt: string | null;
  lastUsedAt: string | null;
  pendingAction: string | null;
  /** reported within the last two minutes */
  online: boolean;
}

export async function helpersFor(accountId: string): Promise<HelperDevice[]> {
  if (MOCK) return [{ id: "d1", name: "Helper on DESKTOP", helperVersion: "0.1.1", state: { folder: "C:\\Program Files (x86)\\World of Warcraft", clients: [{ folder: "_classic_era_", flavor: "era", installed: true, version: "0.3.0", linked: true, needsUpdate: false }], lastSync: new Date(Date.now() - 300000).toISOString(), lastError: null, paused: false, gameRunning: true, status: "Last sync 12:01" }, lastSeenAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), pendingAction: null, online: true }];
  const { data } = await serviceClient().from("device_tokens").select("id, name, helper_version, state, last_seen_at, last_used_at, pending_action").eq("account_id", accountId).is("revoked_at", null).order("created_at");
  const cutoff = Date.now() - 2 * 60 * 1000;
  return (data ?? []).map((d) => ({ id: d.id, name: d.name, helperVersion: d.helper_version, state: (d.state ?? {}) as HelperState, lastSeenAt: d.last_seen_at, lastUsedAt: d.last_used_at, pendingAction: d.pending_action, online: !!d.last_seen_at && new Date(d.last_seen_at).getTime() > cutoff }));
}

export async function requestHelperAction(accountId: string, deviceId: string, action: "sync"): Promise<void> {
  if (MOCK) return;
  await serviceClient().from("device_tokens").update({ pending_action: action }).eq("id", deviceId).eq("account_id", accountId).is("revoked_at", null);
}
