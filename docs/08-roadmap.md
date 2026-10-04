# 08. Roadmap

No deadlines. Each phase has exit criteria; we do not start the next until they are
met. The first phases are deliberately narrow so the full pipeline is proven before
breadth is added.

## Phase 0: Planning (now)

- All docs in this folder reviewed by the owner.
- Open questions resolved or explicitly deferred.
- Owner runs the verification checklist from `03` and reports results.

Exit: owner approves docs; decisions log updated.

## Phase 1: Skeleton and vertical slice (Classic Era only)

Status 2026-10-04: code written and tested locally (version 0.1.0); awaiting the
owner's first real sync.

Goal: one entity type end to end, proving every component.

- Repo scaffolding: pnpm monorepo, SvelteKit app on Netlify, Supabase project with
  migrations, CI running tests and the add-on build.
- `packages/lua-parser` with fixtures; `packages/schema` v1 for the slice.
- Add-on core (init, compat, session, store, ids, link, ack, login line) plus
  `units.lua` and `zones.lua` only.
- `packages/sync-core` with the browser adapter: folder picker, install, link file,
  read, hash, upload, status, ack.
- Ingest and aggregate functions for creatures and zones.
- Wiki page: creature (name, level, classification, type, reaction, positions on a
  blank coordinate grid, build/expansion selector, status badge). Zone page listing
  creatures seen there.
- Journal: character list, "first sightings" timeline.
- Auth, account settings minimal, owner account trusted.

Exit: the owner plays Era for an hour, opens the site, sees the creatures and zones
they encountered, with correct build and locale; a second upload from the same account
dedupes and prunes correctly via ack.

## Phase 2: Capture breadth (Classic Era)

Add modules in this order, each with ingest, aggregation, wiki pages, Journal views:

1. Quests, gossip (quest text, givers, enders, rewards).
2. Items, loot, vendors, trainers (drop rates, sources, prices).
3. Lore text, speech, scenes.
4. Spells, combat (creature abilities), kills, deaths, encounters.
5. Professions, recipes, reputation.
6. Taxi, character, social, PvP, mail.

The helper (`apps/helper`) comes first in this phase (D-0037): the Tauri adapter
over the same sync core, device sign-in, watcher, tray, and updater. Capture
modules follow.

Exit: every entity type in `03` has a page; the owner's Journal has the full event
set; the verification checklist is fully green; the helper syncs the owner's data
with the site closed.

## Phase 3: Progress and achievements

- `packages/achievements` engine and the Classic Era reconstructed catalog.
- Journal: achievements UI mirroring Blizzard's layout, statistics, Loremaster and
  exploration progress with freeze markers.
- Account roll-up.

Exit: the owner's character shows correct Loremaster and exploration progress and
earns at least one reconstructed achievement from live play.

## Phase 4: Public readiness

- Trust model fully active (status rules, trust scores, realm registry, quarantine).
- Admin area: overrides, audit, moderation queue, reprocessing.
- Visibility settings, public profiles, leaderboards, export and delete.
- Manual fallback for non-Chromium browsers.
- Terms and privacy pages.
- Asset pipeline: icons from Blizzard's API, zone maps from client extraction, served
  on wiki pages.
- Search across entities and locales.

Exit: a second person installs from the site with no help, plays, and their data
confirms the owner's. Nothing from them is public until they opt in.

## Phase 5: Other flavors

- Anniversary (`_anniversary_`), then WoW: Forever (launches 2026-11-04), then Retail,
  then Mists: compat layer, flavor-specific modules (achievements catalog, collections,
  Encounter Journal), build tables, phase timelines.

Exit: each flavor passes the Phase 1 slice and Phase 2 checklist.

## Phase 6: Deferred features

- Cosmetics and titles.
- Auction house data.
- Public API.
- CurseForge/Wago distribution.
