# 04. Sync and Transport

How data gets from the game client to the server, and how the add-on gets installed,
updated, removed, and told what has been uploaded. Two transports share one protocol
and one code base (`packages/sync-core`): the browser, with no install, when the site
is open; and the optional helper application, in the background. Neither is required
for the other.

## Hard constraints

- The add-on can only write SavedVariables, and only on logout, `/reload`, or exit.
- The add-on only reads files from its own folder, and only at client start.
- A browser can read and write local folders only through the File System Access API,
  only after the user picks the folder, only while a page from our origin is open.
  Chromium browsers (Chrome, Edge, Brave, Opera) support directory read and write and
  can remember the grant across visits. Firefox and Safari do not support directory
  write, so they get the manual fallback.
- Chrome blocks access to some system folders. The game install folder is allowed.

## The WoW folder

The user picks the top-level install folder once (the one containing `_classic_era_`,
`_anniversary_`, `_retail_`, `_classic_`, `Data`, and the launcher). From there:

```
<root>/
  _classic_era_/
    Interface/AddOns/WoWCompendium/            <- we install here
    WTF/Account/<ACCOUNT>/SavedVariables/WoWCompendium.lua   <- we read here
  _anniversary_/   (same layout)
  _retail_/        (same layout)
  _classic_/       (same layout)
```

The sync module enumerates flavor folders present, and within each, every
`WTF/Account/*/` folder (one per WoW license on that machine). The account folder name
is never sent to the server; the add-on's own identity UUID inside the file is used
instead.

If the user picks a flavor folder instead of the root, we detect that and work with it.
If they pick something else, we explain what to pick.

## Permission flow

1. User clicks "Connect your WoW folder" (a user gesture is required by the API).
2. `showDirectoryPicker({ mode: 'readwrite', id: 'wow-root' })`.
3. Chrome prompts. The user can choose "Allow on every visit" (persistent permission,
   Chrome 122+). We store the directory handle in IndexedDB so later visits can call
   `requestPermission()` without re-picking.
4. On every page load, if a handle exists, we check `queryPermission()`. If `granted`,
   sync runs automatically. If `prompt`, we show a one-click "Resume sync" button
   (another user gesture is needed). If the handle is gone, we ask to pick again.

The site must be served over HTTPS (Netlify does), and `localhost` counts as secure for
development.

## Install, update, remove

The add-on is built in CI into `addon-releases/<version>/` in Supabase Storage with a
manifest listing every file and its hash. The sync module:

- **Install**: creates `Interface/AddOns/WoWCompendium/`, writes every file from the
  manifest, then writes the link file (below). If the game is running, we warn that it
  will load the add-on on next launch.
- **Update**: compares the installed manifest (we write `manifest.json` into the add-on
  folder) with the latest release; rewrites changed files. Updates are applied silently
  on sync when the game is not running (detected by a lock file: `VERIFY` whether the
  client holds a lock on anything we can test; fallback: ask the user).
- **Remove**: deletes the add-on folder. The SavedVariables file is left in place unless
  the user also checks "delete my local data".
- **Integrity**: before every sync, hash the installed files and compare with the
  release manifest. A mismatch marks the upload `addon_modified = true` (see `05`).

The add-on is not published to CurseForge or Wago at first. It may be later for
discovery; the web app would then also accept those installs since the files are the
same.

## The link file

`Interface/AddOns/WoWCompendium/Compendium_Link.lua`, listed in every TOC after the core
files, shipped as an empty table:

```lua
COMPENDIUM_LINK = { account_token = "<opaque token>", linked_at = 1770000000 }
```

The token is a random, per-account, revocable identifier (not the Supabase JWT). The
add-on copies it into SavedVariables at login. The server accepts an upload for an
account only if the token in the file matches a live token for that account, or if the
file carries no token and the upload is being made by a logged-in user who claims it
(first-link flow). Tokens are rotated on request from settings.

## The ack file

`Interface/AddOns/WoWCompendium/Compendium_Ack.lua`, shipped as an empty table:

```lua
COMPENDIUM_ACK = {
  ["Player-4395-01A2B3C4"] = 17,   -- highest session seq fully ingested
}
```

After the server confirms an upload is ingested, the sync module writes the latest ack
values for every character in that WoW license's file. At next login the add-on deletes
sessions with `seq <= ack`. Sessions the server has not acknowledged are kept, so an
ingest failure never loses data. Pruning is also bounded by a size guard: if the file
grows past a threshold (default 20 MB), the add-on keeps the newest sessions, moves the
oldest into a `pending_overflow` list stripped to Journal events only, and the login
line says so.

Because the game only reads these files at client start, a sync done while the game is
running takes effect at the next launch. That is fine.

## Reading and uploading

1. Enumerate candidate files: every `WTF/Account/*/SavedVariables/WoWCompendium.lua`
   under every flavor folder.
2. Read the file, compute SHA-256 of the bytes. Ask the server (`POST /sync/check` with
   the list of hashes) which are new.
3. For each new file: parse in the browser with `packages/lua-parser` only enough to
   extract the schema version, identity, link token, and a per-character summary
   (character GUIDs, max seq, session count). This is for the UI and for early error
   messages; the server re-parses.
4. Upload the raw file to Storage at `uploads/<account_id>/<sha256>.lua` (gzip in
   transit). Insert an `uploads` row via `POST /sync/upload` with the summary.
5. The ingest background function runs. The UI polls `GET /sync/status` and shows
   progress: received, parsing, observations written, aggregating, done.
6. On `done`, the module writes the ack file. On `failed`, nothing is acked and the error
   is shown with a "report" button that attaches the upload ID.

Uploads are idempotent by hash. The same file uploaded twice is a no-op. The file
changes on every logout, so each logout produces at most one new upload.

The whole SavedVariables file is uploaded, not only new sessions. Old sessions are
already pruned by ack, so the file stays small. Observations are deduplicated
server-side by `(character, seq)` so re-uploads of not-yet-acked sessions never double
count.

## The helper

A Tauri tray application for Windows (macOS deferred, D-0025) hosting `sync-core` with
a native file adapter. Behavior:

- **Sign-in**: the helper opens the site in the default browser with a one-time device
  code; the user approves; the helper receives a device token scoped to sync only.
  Tokens are listed and revocable in account settings.
- **Folder**: auto-detects the WoW install from the launcher's registry entry on
  Windows and the default path on macOS; the user can pick another.
- **Install and update**: same manifest flow as the browser. Updates are applied when
  the game is not running (the helper can check the process list, which the browser
  cannot).
- **Watch**: filesystem watcher on every `WTF/Account/*/SavedVariables/` folder across
  flavor folders. On a change to `WoWCompendium.lua`, wait for the file to settle (no
  writes for 5 seconds), then run the standard upload flow and write the ack file.
- **Status**: tray icon state (idle, syncing, error, paused), menu with last sync per
  client and character, pause, open site, quit. No other UI.
- **Updater**: Tauri's built-in updater against our release feed, verified with the
  project's updater keys. The installer itself is unsigned; the download page shows
  the SmartScreen steps.
- **Coexistence**: if both the browser and the helper are active, uploads dedupe by
  hash and acks are idempotent, so nothing conflicts.

## Unsynced detection

Two places detect unsynced data:

- **In game, at login**: the add-on compares `next_seq - 1` against the ack per
  character. If sessions are unacknowledged, it prints the single login line (see `03`).
- **On the site**: when the user opens the site, pending files are found and synced,
  and the Journal shows "last synced" per character.

Both mention the helper as the way to avoid the step. The site should not nag: the
message appears at most once per day per client.

## Manual fallback (non-Chromium browsers without the helper)

- Install: download `WoWCompendium-<version>.zip` with instructions for the AddOns
  folder per flavor and OS. The zip includes the link file pre-filled with the user's
  token (generated per download, so the file is personal).
- Sync: drag the `WoWCompendium.lua` file onto the page, or use a file picker. Same
  upload path. No ack file can be written, so the add-on's pruning falls back to the
  size guard and the user can click "mark as synced" in the UI to get a fresh ack file
  to download and place manually. This is clunky by design; the Chromium path is the
  product.

## macOS and Windows paths

Windows default: `C:\Program Files (x86)\World of Warcraft\`. macOS default:
`/Applications/World of Warcraft/`. The picker handles both; we show the default path
as a hint. Linux via Wine is unsupported but will work if the user picks the prefix
folder.

## Parser

`packages/lua-parser` parses the subset of Lua that Blizzard's SavedVariables writer
emits: nested table constructors with `["string"] = value`, `[number] = value`,
positional values, string literals with Blizzard's escape set (`\n`, `\r`, `\"`, `\\`,
`\124` for the pipe character, `\ddd` decimal escapes), numbers including `nan`/`inf`
guards, booleans, `nil`. It rejects anything else (function calls, operators,
comments beyond a leading `--` line) so a tampered file cannot smuggle constructs. Output
is plain JSON validated by `packages/schema` for the declared schema version. Both the
browser and the ingest function use the same parser; fixtures from real files are
committed.

## Failure handling

| Failure | Behavior |
|---------|----------|
| Permission revoked | Show "Resume sync" button; nothing lost. |
| File unreadable mid-write (game writing) | Retry after 5 seconds, up to 3 times, then skip this cycle. |
| Upload interrupted | Resumable by hash: the next sync re-checks and re-uploads. |
| Ingest fails | Upload kept with error; no ack; admin sees it in the queue; reprocess after fix. |
| Schema version newer than server | Server rejects with "update the site" (deploy lag); client retries later. |
| Schema version older than server supports | Server still accepts; parser keeps every historical version. |
| Add-on modified | Upload accepted, flagged; contributes with reduced trust (see `05`). |
