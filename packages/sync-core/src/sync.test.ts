import { describe, expect, it } from "vitest";
import type { AddonManifest, SyncCheckResponse, SyncStatusResponse, SyncUploadMeta, SyncUploadResponse } from "@compendium/schema";
import { MemoryFileSystem } from "./adapters/memory.js";
import { sha256Hex } from "./adapter.js";
import { detectLayout, findSavedVariables } from "./layout.js";
import { inspectInstall, installAddon, readAckFile, removeAddon, writeAckFile, writeLinkFile } from "./addon.js";
import { luaGlobalFile, luaString } from "./lua-writer.js";
import { readSavedVariables, runSync } from "./sync.js";
import type { SyncClient } from "./client.js";

const SV = `
WoWCompendiumDB = {
["schema"] = 1,
["addonVersion"] = "0.1.0",
["identity"] = "9f1c2a3b-1111-4222-8333-444455556666",
["link"] = { ["accountToken"] = "tok_test", ["linkedAt"] = 1790000000 },
["ack"] = {},
["characters"] = {
["Player-5149-04E14735"] = {
["meta"] = { ["guid"] = "Player-5149-04E14735", ["name"] = "Eigan", ["realm"] = "Mankrik", ["flavor"] = "era", ["classId"] = 3 },
["nextSeq"] = 3,
["sessions"] = {
["1"] = { ["seq"] = 1, ["ctx"] = { ["flavor"] = "era", ["project"] = 2, ["version"] = "1.15.9", ["build"] = 70003, ["locale"] = "enUS", ["realm"] = "Mankrik", ["addon"] = "0.1.0", ["started"] = 1790998608, ["ended"] = 1790999000 },
  ["world"] = { ["creatures"] = { ["2955"] = { ["id"] = 2955, ["name"] = "Plainstrider", ["n"] = 3, ["ft"] = 1790998610, ["lt"] = 1790998700, ["pos"] = { { ["t"] = 1790998610, ["m"] = 1412, ["x"] = 0.52, ["y"] = 0.86, ["k"] = "target" } } } } },
  ["events"] = { { ["t"] = 1790998608, ["k"] = "login", ["m"] = 1412 } },
  ["state"] = { ["level"] = 5 } },
["2"] = { ["seq"] = 2, ["ctx"] = { ["flavor"] = "era", ["project"] = 2, ["version"] = "1.15.9", ["build"] = 70003, ["locale"] = "enUS", ["realm"] = "Mankrik", ["addon"] = "0.1.0", ["started"] = 1791000000 },
  ["world"] = {}, ["events"] = {}, ["state"] = {} },
},
},
},
}
`;

async function wowRoot(): Promise<MemoryFileSystem> {
  const fs = new MemoryFileSystem("World of Warcraft");
  await fs.mkdir("_classic_era_/Interface/AddOns");
  await fs.mkdir("_anniversary_/Interface/AddOns");
  await fs.mkdir("Data");
  await fs.seed("_classic_era_/WTF/Account/12345678#1/SavedVariables/WoWCompendium.lua", SV);
  await fs.seed("_classic_era_/WTF/Account/12345678#2/SavedVariables/Other.lua", "Other = {}");
  return fs;
}

const releaseFiles: Record<string, string> = {
  "WoWCompendium_Vanilla.toc": "## Interface: 11509\ncore/init.lua\n",
  "core/init.lua": "local ADDON, NS = ...\n",
  "Compendium_Link.lua": "COMPENDIUM_LINK = COMPENDIUM_LINK or {}\n",
  "Compendium_Ack.lua": "COMPENDIUM_ACK = COMPENDIUM_ACK or {}\n",
};

async function manifest(): Promise<AddonManifest> {
  const enc = new TextEncoder();
  const files = [];
  for (const [path, text] of Object.entries(releaseFiles)) {
    const bytes = enc.encode(text);
    files.push({ path, sha256: await sha256Hex(bytes), size: bytes.byteLength });
  }
  return { name: "WoWCompendium", version: "0.1.0", files };
}

const fetchFile = async (path: string) => new TextEncoder().encode(releaseFiles[path]!);

describe("layout", () => {
  it("detects the WoW root and its flavor folders", async () => {
    const fs = await wowRoot();
    const layout = await detectLayout(fs);
    expect(layout.kind).toBe("root");
    expect(layout.flavors.map((f) => f.flavor).sort()).toEqual(["anniversary", "era"]);
  });
  it("detects a flavor folder picked directly", async () => {
    const fs = new MemoryFileSystem("_classic_era_");
    await fs.mkdir("Interface");
    await fs.mkdir("WTF");
    const layout = await detectLayout(fs);
    expect(layout.kind).toBe("flavor");
    expect(layout.flavors[0]?.flavor).toBe("era");
    expect(layout.flavors[0]?.path).toBe("");
  });
  it("finds SavedVariables per WoW account folder", async () => {
    const fs = await wowRoot();
    const layout = await detectLayout(fs);
    const era = layout.flavors.find((f) => f.flavor === "era")!;
    const files = await findSavedVariables(fs, era);
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("_classic_era_/WTF/Account/12345678#1/SavedVariables/WoWCompendium.lua");
  });
});

describe("lua writer", () => {
  it("escapes strings the way Blizzard's reader expects", () => {
    expect(luaString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    const file = luaGlobalFile("COMPENDIUM_ACK", { "Player-1-2": 17 }, "note");
    expect(file).toBe('-- note\nCOMPENDIUM_ACK = {\n  ["Player-1-2"] = 17,\n}\n');
  });
});

describe("addon install", () => {
  it("installs, verifies, detects modification, links, acks, and removes", async () => {
    const fs = await wowRoot();
    const era = (await detectLayout(fs)).flavors.find((f) => f.flavor === "era")!;
    const m = await manifest();
    expect((await inspectInstall(fs, era, m)).installed).toBe(false);

    await installAddon(fs, era, m, fetchFile, { accountToken: "tok_abc" });
    let state = await inspectInstall(fs, era, m);
    expect(state).toMatchObject({ installed: true, version: "0.1.0", modified: true, linked: true });
    // link file differs from the shipped one by design, so "modified" must exclude it
    expect(state.differing).toEqual(["Compendium_Link.lua"]);

    await fs.writeText("_classic_era_/Interface/AddOns/WoWCompendium/core/init.lua", "tampered");
    state = await inspectInstall(fs, era, m);
    expect(state.differing).toContain("core/init.lua");

    await writeAckFile(fs, era, { "Player-5149-04E14735": 2 });
    expect(await readAckFile(fs, era)).toEqual({ "Player-5149-04E14735": 2 });
    await writeLinkFile(fs, era, "tok_xyz");
    const linkText = await fs.readText("_classic_era_/Interface/AddOns/WoWCompendium/Compendium_Link.lua");
    expect(linkText).toContain('["account_token"] = "tok_xyz"');
    expect(linkText).toContain('["settings"] = {}');

    await removeAddon(fs, era);
    expect(await fs.exists("_classic_era_/Interface/AddOns/WoWCompendium")).toBe(false);
  });
});

describe("runSync", () => {
  function fakeClient(opts: { known?: Record<string, { uploadId: string; status: string }>; statuses?: SyncStatusResponse[] }) {
    const calls: { uploads: SyncUploadMeta[]; checks: string[][]; statusCalls: number } = { uploads: [], checks: [], statusCalls: 0 };
    let i = 0;
    const client: SyncClient = {
      manifest: async () => manifest(),
      addonFile: async (_v, p) => fetchFile(p),
      check: async (hashes): Promise<SyncCheckResponse> => {
        calls.checks.push(hashes);
        const known = opts.known ?? {};
        return { missing: hashes.filter((h) => !known[h]), known };
      },
      upload: async (_bytes, meta): Promise<SyncUploadResponse> => {
        calls.uploads.push(meta);
        return { uploadId: "up_1", status: "received" };
      },
      status: async () => {
        calls.statusCalls++;
        const list = opts.statuses ?? [];
        return list[Math.min(i++, list.length - 1)]!;
      },
    };
    return { client, calls };
  }

  it("reads and validates a real-shaped SavedVariables file", async () => {
    const fs = await wowRoot();
    const r = await readSavedVariables(fs, "_classic_era_/WTF/Account/12345678#1/SavedVariables/WoWCompendium.lua");
    expect(r.sv.characters["Player-5149-04E14735"]?.sessions["1"]?.world.creatures["2955"]?.name).toBe("Plainstrider");
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uploads new files, polls ingest, and writes the ack file", async () => {
    const fs = await wowRoot();
    const era = (await detectLayout(fs)).flavors.find((f) => f.flavor === "era")!;
    await installAddon(fs, era, await manifest(), fetchFile);
    const { client, calls } = fakeClient({
      statuses: [
        { uploadId: "up_1", status: "ingesting", ack: {} },
        { uploadId: "up_1", status: "ingested", ack: { "Player-5149-04E14735": 1 } },
      ],
    });
    const phases: string[] = [];
    const report = await runSync(fs, client, { sleep: async () => {}, onProgress: (p) => phases.push(p.phase) });
    expect(report.layoutKind).toBe("root");
    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.outcome).toBe("uploaded");
    expect(calls.uploads[0]).toMatchObject({ flavor: "era", flavorFolder: "_classic_era_", identity: "9f1c2a3b-1111-4222-8333-444455556666", accountToken: "tok_test" });
    expect(calls.uploads[0]?.summary.characters[0]).toMatchObject({ name: "Eigan", sessions: 2, maxSeq: 2 });
    expect(phases).toEqual(["reading", "checking", "uploading", "ingesting", "acking", "done"]);
    expect(await readAckFile(fs, era)).toEqual({ "Player-5149-04E14735": 1 });
  });

  it("skips files the server already ingested and never lowers the ack", async () => {
    const fs = await wowRoot();
    const era = (await detectLayout(fs)).flavors.find((f) => f.flavor === "era")!;
    await installAddon(fs, era, await manifest(), fetchFile);
    await writeAckFile(fs, era, { "Player-5149-04E14735": 5 });
    const r = await readSavedVariables(fs, "_classic_era_/WTF/Account/12345678#1/SavedVariables/WoWCompendium.lua");
    const { client, calls } = fakeClient({
      known: { [r.sha256]: { uploadId: "up_0", status: "ingested" } },
      statuses: [{ uploadId: "up_0", status: "ingested", ack: { "Player-5149-04E14735": 2 } }],
    });
    const report = await runSync(fs, client, { sleep: async () => {} });
    expect(report.results[0]?.outcome).toBe("already_synced");
    expect(calls.uploads).toHaveLength(0);
    expect(await readAckFile(fs, era)).toEqual({ "Player-5149-04E14735": 5 });
  });

  it("reports an unparseable file without touching the others", async () => {
    const fs = await wowRoot();
    await fs.seed("_anniversary_/WTF/Account/A#1/SavedVariables/WoWCompendium.lua", "WoWCompendiumDB = { broken");
    const { client } = fakeClient({ statuses: [{ uploadId: "up_1", status: "ingested", ack: {} }] });
    const report = await runSync(fs, client, { sleep: async () => {} });
    const outcomes = report.results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual(["unparseable", "uploaded"]);
  });
});
