# 01. Architecture

## Components

```
 Player's machine                                    Cloud
 ┌───────────────────────────────┐
 │ WoW client (any flavor)       │
 │   └ Add-on (Lua)              │
 │       writes on logout ───┐   │
 │                           ▼   │
 │  WTF/.../SavedVariables/      │
 │     WoWCompendium.lua         │
 │           ▲         │         │
 │  ack/link │         │ read    │        ┌──────────────────────────────┐
 │  files    │         ▼         │        │ Netlify                      │
 │ ┌─────────┴─────────────────┐ │ HTTPS  │  ├ Web app (SvelteKit SSR)   │
 │ │ Browser tab: Web app      │◄├───────►│  └ Background functions      │
 │ │  + Sync module            │ │        │     (ingest, aggregate)      │
 │ │  (File System Access API) │ │        └──────────────┬───────────────┘
 │ └───────────────────────────┘ │                       │
 └───────────────────────────────┘                       ▼
                                             ┌──────────────────────────────┐
                                             │ Supabase                     │
                                             │  ├ Postgres (all data, RLS)  │
                                             │  ├ Auth                      │
                                             │  └ Storage (raw uploads,     │
                                             │      artwork assets)         │
                                             └──────────────────────────────┘
```

### 1. Add-on (`addon/`)

Lua, one add-on with one `.toc` per flavor. Event-driven recorder with a small core
(event bus, session management, journal store, dedupe, flavor compatibility layer) and
one module per capture domain. No frames, no slash commands with UI, no options panel.
Prints one chat line at login (see `04`). Full spec in `03`.

### 2. Web app (`apps/web/`)

SvelteKit with TypeScript, server-side rendered, deployed on Netlify. Serves:

- World Wiki pages (public, cacheable, SEO-friendly).
- Journal pages (authenticated; public profile pages when opted in).
- Account settings, visibility controls, add-on management.
- Admin area: override editor, audit log, moderation queue, reprocessing controls.
- The **sync module**: the client-side code that uses the File System Access API to
  install, update, remove the add-on and to read, parse, and upload SavedVariables.
  Chromium only. Detailed in `04`.

### 3. Ingestion and aggregation (`apps/web/netlify/functions/` or `services/`)

Netlify background functions (up to 15 minutes per invocation) that:

- **Ingest**: pull a raw upload from Storage, parse it server-side (the browser's
  parse is never trusted), validate against the versioned add-on schema, write
  observations. Idempotent per upload.
- **Aggregate**: recompute facts for entities touched by new observations; apply
  consensus rules; produce versioned intervals. Incremental by default, full rebuild
  on demand.
- **Evaluate**: recompute Journal statistics and achievement criteria for affected
  characters.

If Netlify's limits become a problem for very large uploads, the fallback is a
long-running worker (for example, a GitHub Actions job or a small Fly.io container)
consuming a queue table. The raw-upload-first design makes that swap painless.

### 4. Supabase

- **Postgres** is the only database. Row Level Security on every table that holds user
  data. Public wiki tables are readable by anyone; writes only by service role.
- **Auth** for accounts (email magic link to start; OAuth providers can be added).
- **Storage** buckets: `uploads` (private, immutable raw files), `assets` (public
  artwork), `addon-releases` (public, built add-on files served to the sync module).

### 5. Shared packages (`packages/`)

- `schema`: TypeScript types and runtime validators for the add-on's SavedVariables
  format, versioned. Both the browser and the ingest function use it.
- `lua-parser`: parses Blizzard's SavedVariables Lua table literal into JSON. Used in
  browser and server.
- `game-meta`: our own lookup tables: flavor detection, build to patch to expansion,
  locale codes, region codes, realm registry types. Hand-maintained metadata, not
  imported game data.
- `achievements`: criteria definitions and the evaluation engine (pure functions,
  heavily tested).
- `sync-core`: the shared sync protocol (component 8).

### 6. Asset pipeline (`tools/assets/`)

Two sources, in order of preference (decision D-0019):

1. **Blizzard's API and media servers.** The Game Data API has media endpoints for
   items, spells, achievements, creature displays, instances, classes, and races,
   returning image URLs on Blizzard's render servers. Classic Era has its own API
   namespace (`static-classic1x-<region>`) with item and creature media. An admin job
   fetches media for IDs the wiki knows, stores copies in the `assets` bucket keyed by
   entity ID, and refreshes periodically. Requires a Blizzard developer client ID and
   secret; rate limit 36,000 requests per hour.
2. **Extraction from the game client.** For what the API does not provide, above all
   zone map images and minimap tiles, an admin-only command-line tool run by the owner
   against their own installed client extracts files using an open-source CASC
   extractor library and uploads them keyed by file data ID.

Neither source contributes facts; artwork only. Pages render without art gracefully.

### 7. Helper (`apps/helper/`)

Optional desktop tray application for Windows (macOS deferred, D-0025). It does exactly what the
browser sync module does, in the background: locates the WoW folder, installs and
updates the add-on, writes link and ack files, watches the SavedVariables folders, and
uploads on change. With the helper installed, any browser works for the site itself.

Built with Tauri (Rust shell, tiny binary, native tray, built-in updater) hosting the
same TypeScript sync core as the browser. The helper's only UI is a tray menu and a
small status window: signed in as, last sync per client, pause, open site, quit. It
signs in by opening the site in the user's browser and receiving a device token.

The helper ships unsigned (D-0025, D-0029): Windows shows its own SmartScreen prompt,
which the download page explains in one line (we add no warning of our own); the
macOS helper is deferred because unsigned apps are blocked by default there, and
macOS users have the browser path. Updates are verified with
Tauri's own keys. See `04` for the sync protocol.

### 8. Sync core (`packages/sync-core/`)

One implementation of the sync protocol with a `FileSystemAdapter` interface. Two
adapters: the browser's File System Access API handles, and Tauri's filesystem API.
Everything else (folder layout detection, manifest install, hashing, parsing, upload,
status polling, ack and link writing) is shared and tested once.

## Data flow

1. Player plays. Add-on records into memory, dedupes, aggregates counters.
2. Player logs out or reloads. Client writes `WoWCompendium.lua`.
3. Player opens the web app in Chrome (now or later). Sync module scans the granted WoW
   folder for data files, hashes each, asks the server which hashes are new, uploads
   new ones to Storage, and records an `uploads` row.
4. Ingest function parses and writes observations. Marks the upload ingested.
5. Aggregate function updates facts and Journal state. Evaluate function updates
   achievements and leaderboards.
6. Sync module writes the ack file into the add-on folder with the highest session
   sequence number acknowledged per character. Next login, the add-on prunes
   acknowledged sessions.
7. Wiki and Journal pages read from facts, overrides, and Journal tables.

## Stack decisions and reasons

| Choice | Reason |
|--------|--------|
| SvelteKit + TypeScript | Conventional, well documented, first-class Netlify adapter, SSR for SEO on a content site, small client bundles for a wiki. Next.js was the alternative; SvelteKit has less boilerplate and fewer Netlify surprises. |
| Tailwind CSS | Utility styling keeps design consistent without a component library dependency. |
| Netlify | Owner already uses it. Hosting, functions, background functions, deploy previews from GitHub. |
| Supabase | Owner already uses it. Postgres with RLS, Auth, Storage in one place. |
| pnpm workspaces | Shared packages between browser, functions, tools. |
| Lua 5.1 (WoW dialect) | No choice. |
| Vitest | Tests for TypeScript packages and functions. |
| busted | Tests for pure-logic Lua (serialization, dedupe, sequence handling) with a mocked WoW API surface. |
| Supabase CLI migrations | Schema as code, reviewed in PRs. |

## Environments

- `dev`: local Supabase (Docker) via Supabase CLI, local SvelteKit dev server. The
  sync module works against `localhost` because Chrome treats it as a secure context.
- `preview`: Netlify deploy previews per PR against a shared `staging` Supabase project.
- `prod`: Netlify production against the `prod` Supabase project.

Secrets live in Netlify and Supabase, never in the repo.

## Repository layout (planned)

```
wowwiki/
  CLAUDE.md
  README.md
  docs/
  addon/
    WoWCompendium/
      WoWCompendium_Vanilla.toc      # Classic Era
      WoWCompendium_TBC.toc          # Anniversary: folder is _anniversary_; TOC suffix VERIFY (see 10)
      WoWCompendium_Mists.toc        # Mists Classic
      WoWCompendium_Mainline.toc     # Retail
      WoWCompendium_Forever.toc      # WoW: Forever; suffix VERIFY at launch
      core/                          # bus, session, store, compat, ids
      modules/                       # one file per capture domain
      Compendium_Link.lua            # written by web app; default ships empty
      Compendium_Ack.lua             # written by web app; default ships empty
    tests/                           # busted specs with mocked API
    build/                           # version stamping, zip, release manifest
  apps/
    web/                             # SvelteKit app + Netlify functions
    helper/                          # Tauri tray app hosting sync-core
  packages/
    schema/
    lua-parser/
    game-meta/
    achievements/
    sync-core/
  supabase/
    migrations/
    seed/
  tools/
    assets/
```

## Testing strategy

- **Lua**: pure logic covered by busted. Capture modules are verified manually in the
  client against a checklist in `03` (items marked `VERIFY`). A debug build can dump
  extra diagnostics to SavedVariables; never to the screen.
- **Parser and schema**: fixture files from real SavedVariables outputs committed under
  `packages/lua-parser/fixtures/` (scrubbed of account identifiers). Every add-on schema
  version keeps its fixture forever so reprocessing stays testable.
- **Aggregation and achievements**: property-style tests on pure functions.
- **Web**: a thin set of Playwright tests for sync flow using a fake directory handle.
- **Database**: RLS policies tested with pgTAP or SQL tests run in CI against local
  Supabase.

## Non-functional targets

- Add-on: no measurable frame-time impact during combat. Memory under a few MB for a
  long session. SavedVariables file under 10 MB per account in normal use (pruning
  guarantees this; see `04`).
- Upload: a 10 MB file ingests within one background function invocation.
- Wiki pages: served from cache with sub-second TTFB for anonymous readers.
- Storage: raw uploads are small text; even millions of sessions are inexpensive.
