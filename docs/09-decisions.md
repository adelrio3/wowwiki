# 09. Decision Log

Each decision has an ID, date, status, context, decision, consequences. To change a
decision, add a new entry that supersedes the old one. The old entry is then collapsed
to its title, a status line naming the successor, and one sentence on why it was
rejected; its full text moves to `docs/archive/decisions-superseded.md`, which is
history, not guidance. This keeps "we already rejected that, and why" visible without
keeping the rejected reasoning in the reading path.

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
Date: 2026-10-03  Status: accepted; scope of Blizzard API use under review (`10` item C)
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

## D-0004: Browser folder access is the only transport
Status: superseded by D-0018. Rejected because the owner wants the background helper
from the first release, not later.

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
Date: 2026-10-03  Status: under review (`10` item B)
Context: Achievement lists, journals, Encounter Journal, spellbooks exist in the client
without being "seen" in the world.
Decision: Admit them to the wiki, tagged `client_catalog`, as long as they are
objective. Player-specific state from the same APIs goes to the Journal.
Consequences: Faster wiki coverage in flavors that have catalogs. Readers can tell
catalog-sourced facts from encounter-sourced facts.

## D-0007: Artwork only via our own extraction pipeline
Status: superseded by D-0019. Rejected because Blizzard's own API serves most artwork
directly; extraction is kept only for what the API lacks.

## D-0008: Version by build, display by expansion with patch notes and history panel
Status: superseded by D-0020. Rejected because anything finer than expansion in the
reader UI was judged too loose to interpret.

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
Date: 2026-10-03  Status: under review (`10` item A)
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

## D-0018: The helper ships in the first release alongside the browser transport
Date: 2026-10-03  Status: accepted
Context: Supersedes D-0004. The owner wants users to be able to sync without opening
the site, from day one.
Decision: Two transports, one protocol, one code base (`packages/sync-core`). Browser
via File System Access API; helper via a Tauri tray app on Windows and macOS. Neither
is required for the other. The helper lets non-Chromium browsers have the full
experience.
Consequences: A desktop build, signing, notarization, and an updater join the scope.
The helper lands in Phase 2 after the browser path proves the protocol.

## D-0019: Artwork from Blizzard's API first, client extraction second
Date: 2026-10-03  Status: accepted
Context: Supersedes D-0007. Blizzard's Game Data API has media endpoints (items,
spells, achievements, creature displays, instances, classes, races) including a
Classic Era namespace; it has no zone map images.
Decision: An admin job fetches artwork from the API for known entity IDs and stores
copies in our bucket. Zone maps and anything else the API lacks come from the
extraction tool run by the owner. Artwork never contributes facts.
Consequences: Needs a Blizzard developer client; rate limits respected; API coverage
per flavor verified during Phase 4.

## D-0020: Readers see expansion only
Date: 2026-10-03  Status: accepted
Context: Supersedes D-0008's display rule. "Something they recognize" was too loose.
Decision: Observations still carry build; facts still carry build intervals. The reader
UI offers an expansion selector and nothing finer. Build and patch detail exist only in
admin tools.
Consequences: Where a value changed within an expansion, the page shows the latest
confirmed value for that expansion; the earlier value is reachable only by admins
until a later decision says otherwise.

## D-0021: Decision log hygiene
Date: 2026-10-03  Status: accepted
Context: The owner asked whether keeping old decisions risks reintroducing rejected
thinking into AI sessions.
Decision: Superseded decisions are collapsed to a stub with the rejection reason; full
text is archived outside the reading path. Stubs stay because "already rejected,
because X" is what stops a re-proposal.
Consequences: `CLAUDE.md` tells sessions not to read the archive unless asked about
history.

## D-0022: WoW: Forever is a fifth flavor
Date: 2026-10-03  Status: accepted
Context: Blizzard's Classic-plus branch launches 2026-11-04 with new zones, talents,
dungeons, raids, and factions on a new client line (beta interface 16001, build
1.60.x, folder `_classic_beta_` during beta). It diverges from Era content, so it
cannot share Era's facts.
Decision: Flavor key `forever`, its own folder, TOC, build table, and facts. Supported
after Anniversary in Phase 5. Beta data is accepted but tagged `beta` and excluded
from status computation.
Consequences: Launch folder name and TOC suffix must be verified at launch. Entities
shared with Era by ID are separate facts under `forever`; a later decision may add a
cross-flavor "same thing" link for navigation.
