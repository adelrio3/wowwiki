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
Alternatives: each option that was on the table and the one-line reason it lost.
Consequences: what follows, including what we gave up.
```

The `Alternatives` line is what makes the log past-proof: a future session that wants
to propose X finds X already weighed, with the reason it lost, next to the decision
that beat it. If the owner changes their mind, the new entry says which alternative
was promoted and why the old reason no longer holds.

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

## D-0006: Client-held catalogs are observations
Date: 2026-10-03  Status: accepted (reaffirmed 2026-10-03 after review)
Context: Achievement lists, journals, Encounter Journal, talent trees exist in the
client without the player encountering the thing in the world. The owner's concern
was never "witnessed vs. listed"; it was that every byte must come from the client
and nothing else.
Decision: Reading a catalog from the client is an observation like any other. Catalog
records carry source `client_catalog` for provenance, follow the same consensus and
status rules, and are not displayed differently. Player-specific state from the same
APIs goes to the Journal.
Alternatives: exclude catalogs (loses the only source of achievement criteria and
Encounter Journal text); show "listed, not yet witnessed" until encountered (adds a
distinction the owner does not want).
Consequences: Flavors with catalogs fill faster. Provenance still lets us answer
"did anyone actually see this" when it matters.

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
Alternatives: three accounts (slower bootstrap, marginally cleaner); one account
(no consensus at all, rejected: tampering would show immediately).
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
Decision: As in `01`.
Alternatives: Next.js (larger ecosystem, more boilerplate, more Netlify runtime
friction); Astro (excellent for static wiki pages, weaker for the authenticated
Journal and admin app); plain Express + templates (no SSR tooling, more hand-rolling).
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
Alternatives: JSON string built at logout (logout hitch on large sessions, custom
serializer to maintain); incremental serialization during play (CPU during combat,
complexity).
Consequences: Parser must handle Blizzard's escape rules exactly; fixtures from real
files are required.

## D-0016: Raw uploads retained forever
Status: superseded by D-0023. Rejected because indefinite retention of every file is
wasteful once the pipeline is stable; a bounded window gives the same bug-recovery
benefit.

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
Alternatives: Electron (100 MB+ download for a tray app); Go or Rust tray binary
without a web layer (cannot share the TypeScript sync core, so two implementations);
browser-only forever (D-0004, rejected by owner).
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
Alternatives: extraction only (D-0007, more owner labor per build); scraping Wowhead
(forbidden by their terms); no artwork (pages look unfinished).
Consequences: Needs a Blizzard developer client; rate limits respected; API coverage
per flavor verified during Phase 4.

## D-0020: Readers see expansion only
Date: 2026-10-03  Status: accepted
Context: Supersedes D-0008's display rule. "Something they recognize" was too loose.
Decision: Observations still carry build; facts still carry build intervals. The reader
UI offers an expansion selector and nothing finer. Build and patch detail exist only in
admin tools.
Alternatives: patch-level selector (too granular for readers); expansion plus a
"changed in patch X" note (D-0008, judged loose); no versioning in the UI at all
(loses the preservation goal).
Consequences: Where a value changed within an expansion, the page shows the latest
confirmed value for that expansion; the earlier value is reachable only by admins
until a later decision says otherwise.

## D-0021: Decision log hygiene
Date: 2026-10-03  Status: accepted
Context: The owner wants future iterations past-proof: no rejected idea should come
back without the reason it lost being seen first, and no rejected reasoning should
sit in the default reading path.
Decision: Three mechanisms. (1) Every decision lists its alternatives with the reason
each lost. (2) Superseded decisions collapse to a stub with the rejection reason;
full text goes to `docs/archive/decisions-superseded.md`, outside the reading path.
(3) Promoting a previously rejected alternative requires a new entry naming the old
decision and why its reason no longer holds.
Alternatives: keep full text of superseded decisions inline (rejected reasoning in
the reading path); delete superseded decisions (the re-proposal guard is lost);
a separate "rejected ideas" list (duplicates what Alternatives lines already hold).
Consequences: `CLAUDE.md` tells sessions not to read the archive unless asked about
history, and to check Alternatives before proposing a change.

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

## D-0023: Bounded retention with compaction
Date: 2026-10-03  Status: accepted
Context: Supersedes D-0016. Raw files matter for recovering from parser and ingest
bugs, which are most likely early; they are worthless once the pipeline is stable.
Individual observations stop adding information once enough accounts agree.
Decision: Raw uploads are kept for a rolling 90 days, then deleted; the first 3
uploads per (flavor, build) are kept indefinitely as test fixtures (scrubbed of
identifiers). Observations are compacted per (fact, patch): once 50 distinct
contributors have reported a value, further reports fold into the fact's counters
and are not stored as rows; the 50 retained rows keep provenance. All numbers are
configuration. Deleting an account removes its raw uploads immediately and tombstones
its retained observation rows.
Alternatives: keep everything forever (D-0016, wasteful); keep nothing raw (a bug
found a week after ingest loses that week's data with no recovery); compaction only
without a raw window (same loss).
Consequences: Reprocessing can only reach back 90 days. Terms still say wiki
contributions are anonymous and irrevocable after deletion.

## D-0024: Blizzard's API is a trust signal, never a source and never a veto
Date: 2026-10-03  Status: accepted
Context: The owner opened the door to Blizzard's Game Data API provided our rules
hold. Observed data is the source of truth; the API's relationship to live game data
is unknown and may be wrong.
Decision: Beyond artwork (D-0019), the API is used only as a cross-check. When an
observed fact agrees with the API, the fact's confidence and the contributor's trust
score rise. When they disagree, nothing is lowered: the observed value stands, and
the disagreement is logged for admin visibility. API values are never displayed and
never stored as facts.
Alternatives: artwork only (loses a cheap trust signal); API as displayed facts
tagged by source (makes the wiki derivative and contradicts D-0001); disagreement
lowers trust (gives an external dataset a veto over observation).
Consequences: Needs a developer client (free). A cross-check job in the aggregate
pipeline; an admin view of disagreements, which may also surface real API errors.

## D-0025: The helper ships unsigned
Date: 2026-10-03  Status: accepted
Context: Code signing without warnings costs money (an Apple developer account
yearly, a Windows code-signing certificate yearly). The owner is opposed to paying.
Decision: The Windows helper ships unsigned; the install page shows the exact
SmartScreen steps ("More info", then "Run anyway"). The macOS helper is deferred:
unsigned, un-notarized apps are blocked by default on current macOS and the bypass is
awkward; macOS users use the browser path, which works fully. Update integrity uses
Tauri's own signing keys, which are free and independent of OS signing. If the
project is open-sourced, apply to SignPath Foundation's free signing for
open-source Windows software (open question `10`).
Alternatives: pay for both (rejected by owner); Windows only with paid cert (same
objection); ship no helper (D-0018 rejected that).
Consequences: Some Windows users will refuse the warning; they still have the
browser. macOS helper revisited if a free signing path appears or the owner changes
their mind.

## D-0026: Opted-in Journal profiles are visible to anyone, signed in or not
Date: 2026-10-03  Status: accepted
Context: "Public" needed a precise meaning.
Decision: Once a user opts a Journal section in, anyone with the link can view it,
including visitors who are not signed in. The World Wiki is always visible to all.
Alternatives: signed-in users only (adds friction to sharing a profile link; no
privacy gain since sign-up is open).
Consequences: Public profile pages are cacheable like wiki pages. Search engines may
index them; the profile settings page says so.

## D-0027: Leaderboards show character names by default
Date: 2026-10-03  Status: accepted
Context: Leaderboards are opt-in; the question was what to show once opted in.
Decision: Character name and realm by default, with an option to show the account's
display name instead.
Alternatives: display name by default (less recognizable to other players).
Consequences: None beyond the setting.

## D-0028: Helper is offered at every login where it applies
Date: 2026-10-03  Status: accepted
Context: The proposal to limit the offer to once a day was unnecessary.
Decision: The add-on's single login line mentions the helper whenever unsynced data
exists, every login. The site offers the helper whenever it finds unsynced data for a
user who has not installed it. No daily cap.
Alternatives: once per day (rejected by owner as needless).
Consequences: None.

## D-0029: Repository stays private; no open-source license; no code signing
Date: 2026-10-03  Status: accepted
Context: Free Windows code signing requires an open-source project. The owner does
not want to open-source the project and accepts install warnings.
Decision: Private repository. The Windows helper ships unsigned with install
instructions (D-0025). No signing service is pursued.
Alternatives: open-source with free signing (rejected by owner).
Consequences: Windows SmartScreen warning on helper install; macOS helper deferred.

## D-0030: Login line wording, stack, and distribution confirmed
Date: 2026-10-03  Status: accepted
Context: Owner confirmed three proposed defaults in one pass.
Decision: Login line as specified in `03` (unsynced count, unlinked notice, helper
mention; silent otherwise). Stack per D-0013 is final. CurseForge and Wago
distribution stays deferred.
Alternatives: none raised.
Consequences: None.
