# 09. Decision Log

Append-only. Each decision has an ID, date, status, context, decision, consequences.
To change a decision, add a new entry that supersedes the old one; do not edit the old
one beyond its status line.

Format:

```
## D-NNNN: Title
Date: YYYY-MM-DD  Status: accepted | superseded by D-MMMM
Context: why this came up.
Decision: what we chose.
Consequences: what follows, including what we gave up.
```

---

## D-0001: Wiki data comes only from our add-on
Date: 2026-10-03  Status: accepted
Context: The owner wants an independent source of truth, not a derivative of Wowhead
or the Blizzard API.
Decision: Universal data enters only through add-on captures. No imports. Artwork is
the single exception (D-0007).
Consequences: The wiki starts empty and grows with play. Some data (prerequisites,
spawn timers) is only inferable, never imported. We avoid licensing entanglement with
third-party datasets.

## D-0002: Multi-user, public, from the first line of code
Date: 2026-10-03  Status: accepted
Context: Public release is the goal; the owner is the only tester at first.
Decision: Every table has RLS, every input is untrusted, consensus and trust models
exist from the start. A "trusted account" flag lets the single tester see confirmed
data.
Consequences: More upfront design; no later rewrite from single-user to multi-user.

## D-0003: Objective vs. experiential split
Date: 2026-10-03  Status: accepted
Context: Bulk client catalogs and player-specific data both come from the same add-on.
Decision: Anything subjective or player-specific goes to the Journal; only objective
world facts go to the wiki. The add-on tags each record accordingly; the server
enforces it by schema.
Consequences: The wiki never shows "your" anything. The Journal is where enjoyment
lives.

## D-0004: Browser folder access is the transport; no required local software
Date: 2026-10-03  Status: accepted
Context: Add-ons cannot network; browsers cannot read disk unprompted. The owner does
not want users to install anything.
Decision: Use the File System Access API in Chromium browsers for install, update,
removal, reading, and ack. Manual fallback elsewhere. An optional helper may come
later and is advertised when unsynced data is detected, at most once per day.
Consequences: Chromium-only for the smooth path. Sync happens only when the site is
open. The owner accepted both.

## D-0005: Ack and link files written into the add-on folder
Date: 2026-10-03  Status: accepted
Context: The add-on cannot receive data at runtime, but reads its own files at client
start.
Decision: The web app writes `Compendium_Ack.lua` (highest ingested session per
character) and `Compendium_Link.lua` (account token). The add-on prunes acknowledged
sessions and stamps uploads with the token.
Consequences: Pruning lags one client restart behind sync. Safe by construction: only
ingested data is ever pruned.

## D-0006: Client-held catalogs are admissible wiki data
Date: 2026-10-03  Status: accepted
Context: Achievement lists, journals, Encounter Journal, spellbooks exist in the client
without being "seen" in the world.
Decision: Admit them to the wiki, tagged `client_catalog`, as long as they are
objective. Player-specific state from the same APIs goes to the Journal.
Consequences: Faster wiki coverage in flavors that have catalogs. Readers can tell
catalog-sourced facts from encounter-sourced facts.

## D-0007: Artwork via our own extraction pipeline
Date: 2026-10-03  Status: accepted
Context: The add-on can export icon file IDs but not images. The owner is willing to
obtain assets elsewhere and keep them.
Decision: An admin-only command-line tool, run by the owner against their own game
client, extracts icons and map tiles using an open-source CASC extractor library and
uploads them to our storage keyed by file data ID. We do not scrape Wowhead (their
terms forbid it) and do not depend on third-party ID-to-name tables.
Consequences: Artwork lags behind data until the owner runs the tool per client build.
Pages render without art gracefully.

## D-0008: Version by build, display by expansion
Date: 2026-10-03  Status: accepted
Context: Data changes patch to patch; readers think in expansions.
Decision: Observations carry build; facts carry build intervals; pages collapse to
expansion with patch-change notes and an expandable history.
Consequences: A hand-maintained build→patch→expansion table in `game-meta`. Unknown
builds are flagged for classification.

## D-0009: Localized text from day one
Date: 2026-10-03  Status: accepted
Context: Contributors play in many client languages.
Decision: Every text field is stored per locale with intervals. Rendering falls back
enUS → any.
Consequences: Slightly larger tables; no retrofit.

## D-0010: Privacy defaults and other players' data
Date: 2026-10-03  Status: accepted
Context: Owner wants private by default, opt-in sharing, BattleTag shown only on
opt-in, and no hard line against recording other players seen.
Decision: As specified in `07`. Other players' data is private to the observer,
never pooled publicly, redactable on request. New uses decided case by case here.
Consequences: Social features stay personal until a decision says otherwise.

## D-0011: Consensus threshold of two accounts
Date: 2026-10-03  Status: accepted
Context: Owner indifferent between two and three.
Decision: Two distinct accounts confirm; single-source facts display as unconfirmed;
trusted accounts count double. Threshold is configuration.
Consequences: Faster confirmation; dispute rules handle conflicts.

## D-0012: Achievements mirror Blizzard; Classic Era reconstructs Wrath's set
Date: 2026-10-03  Status: accepted
Context: Owner wants the in-game achievement feel, Loremaster and exploration
especially, no wiki gamification.
Decision: Per `06`. A small set of tasteful Compendium-original achievements is
allowed. Cosmetics and titles get schema hooks only.
Consequences: Zone-level achievements depend on a frozen catalog, so they show
progress before they can be earned.

## D-0013: Stack: SvelteKit + TypeScript on Netlify, Supabase, pnpm monorepo
Date: 2026-10-03  Status: accepted
Context: Owner has Netlify and Supabase subscriptions and no frontend preference.
Decision: As in `01`. Next.js was the alternative; SvelteKit chosen for less
boilerplate and smoother Netlify SSR.
Consequences: Owner can overrule before Phase 1 starts; afterwards the cost of
switching grows.

## D-0014: Classic Era is the first flavor; Anniversary second
Date: 2026-10-03  Status: accepted
Context: The owner plays Classic Era (vanilla): launcher product "World of Warcraft
Classic", launched into "Classic Era", version 1.15.9 build 70003 at the time of
writing. Their install has `_classic_era_` and `_anniversary_` folders only. The
launcher also lists "Burning Crusade Anniversary", "Mists of Pandaria Classic",
"World of Warcraft" (Retail, Midnight 12.x), and a "WoW: Forever - Beta" product we
have not investigated.
Decision: Build and verify against Era first. Anniversary next because it is already
installed. Retail and Mists after.
Consequences: The compat layer is designed for all four but exercised on Era only in
early phases.

## D-0015: SavedVariables stay native Lua tables; no in-add-on serialization
Date: 2026-10-03  Status: accepted
Context: Serializing to JSON at logout could stall the client; Blizzard's writer is
fast and deterministic.
Decision: The add-on stores plain tables. Our TypeScript parser reads the Lua literal.
Consequences: Parser must handle Blizzard's escape rules exactly; fixtures from real
files are required.

## D-0016: Raw uploads are immutable and retained forever
Date: 2026-10-03  Status: accepted
Context: "Preserve the world" plus the ability to fix pipeline bugs without losing
history.
Decision: Every upload is stored as received. All derived data is rebuildable through
reprocessing. Account deletion removes the user's raw uploads but tombstones, not
deletes, derived observations.
Consequences: Terms must say wiki contributions are irrevocable and anonymous after
deletion.

## D-0017: Add-on has no in-game UI; one login line only
Date: 2026-10-03  Status: accepted
Context: Owner wants a silent recorder.
Decision: No frames, no options, no slash UI. One chat line at login, only when there
is something to say (unsynced data, unlinked).
Consequences: All configuration happens on the site and reaches the add-on through
the link and ack files.
