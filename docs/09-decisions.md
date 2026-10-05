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
Decision: The Windows helper ships unsigned. We add no warning of our own; Windows
itself shows its SmartScreen prompt, and the download page carries one line of
instructions for it ("More info", then "Run anyway"). The macOS helper is deferred:
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

## D-0027: Leaderboards show character names
Status: superseded by D-0031. Rejected because a leaderboard identifies a player, and
the player's identity across characters is the BattleTag.

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

## D-0031: Leaderboards identify players by BattleTag
Date: 2026-10-03  Status: accepted
Context: Supersedes D-0027. A leaderboard ranks players, and a player's identity
across all their characters is the BattleTag.
Decision: Opting into leaderboards shows the account's BattleTag as the identity on
every board. Boards whose metric belongs to one character (for example Hardcore
level reached) show that character's name and class as detail next to the BattleTag.
Opting into leaderboards therefore implies showing the BattleTag; the settings page
says so in one line.
Alternatives: character names (rejected: not a player identity); display name
(rejected: not recognizable in game).
Consequences: The add-on records the BattleTag (`BNGetInfo()`), stored privately
until the leaderboard opt-in.

## D-0032: The Classic Era achievement list is authored by the team
Date: 2026-10-03  Status: accepted
Context: Era has no achievements in the client, so no tool can read them. The owner
does not want to wait and does not want to write anything by hand.
Decision: The team writes the Era achievement list as versioned content in the
repository, modeled on the Wrath of the Lich King achievements for this content, and
presents it to the owner in chat for review. It is fixed once released; later
additions are new achievements, never changes to existing criteria. Named things in
criteria (subzones, bosses, factions, dungeons) get wiki pages at once, empty of
facts until observed, labeled as such. Loremaster uses fixed per-continent quest
counts (550 Eastern Kingdoms, 700 Kalimdor, tunable before release only).
Alternatives: read from a client that has Wrath achievements (none exists today;
Anniversary will, years out); derive lists from observations (moving target,
rejected by owner); owner writes by hand (rejected by owner).
Consequences: The names inside the Era list come from the team's knowledge of the
game, not from a client. They are achievement design, not wiki facts, and are
labeled accordingly on the pages they create. If an entry is later found not to
match the real game, it is corrected through the override and audit path, and the
wiki pages it created are corrected or archived; a correction to criteria is the one
exception to "criteria never change" and is logged with its reason.

## D-0033: Player comments ship in the first release, tightly scoped
Date: 2026-10-03  Status: accepted
Context: Owner weighed the moderation cost against the value of player notes.
Decision: Comments on wiki pages: signed-in users only, plain text, no links or
images, report button, administrator delete and ban, rate limits, visually separate
from observed facts.
Alternatives: no comments in the first release (rejected: adding later means
redesigning every page); rich comments with links and images (more abuse surface).
Consequences: Moderation queue gains comment reports. Terms cover user content.

## D-0034: Major versions are rebuilt from scratch; the database is permanent
Date: 2026-10-03  Status: accepted
Context: The owner wants to avoid the drift that comes from patching code over code
across long AI sessions, without specifying every detail of the implementation.
Decision:
- Versions use MAJOR.MINOR.PATCH (semantic versioning). Everything before 1.0.0 is a
  0.x release built in one continuous effort in the original session, iterating on
  documents and code together. 1.0.0 begins a new session that rebuilds the entire
  code base from scratch, using only the documents, and then continues through 1.1.0,
  1.2.0 and patch releases 1.0.1, 1.0.2 within that session. 2.0.0 starts the next
  fresh session, and so on.
- The database is never rebuilt. Its structure is documented precisely enough in
  `02` (fixed table and column names, meanings, layer rules) that code written from
  scratch can continue using the data earlier versions collected. Schema changes
  after 1.0.0 are migrations, never recreation.
- What carries forward across a rebuild: the design documents, the decision log, the
  engineering notes, test fixtures and acceptance tests, verified client facts (probe
  results), artwork assets, secrets and environment configuration, and the live
  database with its raw uploads. Code does not carry forward.
- The documents express intent and rules, not every implementation detail. A fresh
  session is expected to find its own way, possibly a better one. Hard-won solutions
  are the exception and are recorded in `11-engineering-notes.md` with the problem,
  the trick, the constraint it exploits and why that works, and what failed first.
Alternatives: patch forever in one session (drift and layering, rejected by owner);
specify every detail so rebuilds are mechanical (forecloses better solutions,
rejected by owner); rebuild on every commit (impractical, rejected by owner).
Consequences: A session starting a new major version must not preserve prior code.
Retention of raw uploads (D-0023) applies as written; the database itself is the
continuity, not the code.

## D-0035: Design direction
Status: superseded by D-0039. Rejected because both the dark "archive" and the light
"field guide" were styling passes on the same top-menu layout, which the owner found
unintuitive to move around in.

## D-0036: The add-on never changes client settings
Date: 2026-10-04  Status: accepted
Context: To see friendly NPCs nearby, the add-on could turn on friendly nameplates.
The owner ruled that out: players must not change how they play to feed capture.
Decision: The add-on captures only what the client exposes during normal play. It
never sets CVars or alters any client setting, never opens windows, and never
prompts. Slower coverage is accepted.
Alternatives: auto-enabling name-only friendly nameplates (rejected: invasive);
an opt-in setting for it (rejected: still a playstyle change the project asks for).
Consequences: Friendly NPC coverage depends on hover, click, speech, and combat log
across contributors. A test asserts `SetCVar` is never called.

## D-0037: The helper moves up to the first public phase
Date: 2026-10-04  Status: accepted
Context: Chromium blocks folder access under Program Files (N-0017), the default
install location, so most Windows players cannot use the browser path.
Decision: The helper is built right after capture breadth begins, not after it,
and is the recommended path on Windows. The browser path remains for installs
outside Program Files and for macOS.
Alternatives: ask every player to move their game folder (works, but a hurdle);
browser-only until Phase 4 (leaves most players unable to start).
Consequences: Phase 2 ordering in docs/08 changes; the Sync page explains both
paths.

## D-0038: NPCs and creatures are separate wiki categories; pets are never recorded
Date: 2026-10-04  Status: accepted
Context: The first wiki listed every unit in one "Creatures and NPCs" table with an
NPC tag decided by roles alone, so guards, bankers and apothecaries the player had
not interacted with showed as creatures, and player pets appeared as wiki units.
Decision: The wiki has two categories, NPCs and Creatures, always presented as
separate tables and breadcrumbs. An NPC is a person in the world: anyone a player
could talk to or who stands around a settlement, regardless of whether the observer
can attack them. A Creature is a beast or monster to fight. The category is derived
at read time from the union of all contributors' signals (role, subtitle, civilian,
not attackable, friendly reaction), so one data model `creature` entity serves both.
The add-on skips `Pet` GUIDs entirely.
Alternatives: a separate `npc` entity type in the data model (rejected: Blizzard
uses one ID space, and the category can flip as more contributors report; a stored
type would need migrations for a presentation choice); roles-only classification
(rejected: misses every uninteracted townsperson); recording pets with an owner flag
(rejected: a pet is a player's possession, not a fact about the world).
Consequences: Units captured before 0.2.1 lack the attackable signal and may show
as creatures until re-observed. Section headings, counts and breadcrumbs name the
category; the data model is unchanged. The exclusion is enforced in three places,
because the add-on alone was not enough (N-0019): the add-on skips `Pet` GUIDs and
player-controlled units, ingest drops `Pet` records, and migration 0002 removed the
pets that reached the database before this decision.

## D-0039: The site is an atlas with a sidebar, not a brochure with a top menu
Date: 2026-10-04  Status: accepted
Context: Two visual passes (D-0035) kept a marketing-style home page, a three-item
top menu, flat tables with status badges, and an empty coordinate grid in place of a
map. The owner found the result unintuitive three times running and asked for a
restart from the drawing board. Readers come to look something up; the front page
should still surface the most interesting finds.
Decision: A persistent left sidebar carries everything a reader navigates by: search
(the `/` key focuses it), the game version, the world categories (Zones, NPCs,
Creatures, Areas, Flight paths) and the reader's own pages (Journal, Add-on). On
phones the same sidebar is a drawer behind a menu button. Pages are documents with
a consistent header and, for entities, a fact sheet at the side. Positions are shown
as the coordinates players type in-game, in tables, not on a blank grid; a drawn map
returns only when real map artwork exists. Trust status is a sentence on the entity
page ("Confirmed by 2 players."), never a badge on every list row. The front page
opens on search and zones, then shows notable finds (rares, elites, bosses) and what
was seen most recently. Visuals: warm off-white page, white cards, one link blue,
gold only as a mark, Fraunces for titles, Inter for text, JetBrains Mono for numbers,
all self-hosted. Dark theme kept.
Alternatives: keep the top menu and restyle again (rejected: the menu does not scale
past three items and hides the categories a wiki is browsed by); a Wowhead-style
dark gold interface (rejected earlier by the owner as unappealing); a bottom tab bar
on phones (deferred: a drawer reuses the sidebar unchanged); status badges on rows
(rejected: noise for readers who do not know the trust model).
Consequences: docs/12 is rewritten; category pages exist for every world entity
type and new entity types get one each; the audit script covers every page; the map
panel component is removed until artwork arrives.

## D-0040: Zone maps are clean; pins appear only on entity pages
Date: 2026-10-04  Status: accepted
Context: Zone pages will show the real zone artwork as their most important
content. Every NPC and creature seen in a zone has positions, which over time means
an unreadable number of pins.
Decision: The zone map is shown with nothing drawn on it, and there is no switch to
overlay positions. Pins are drawn only on pages about one thing: an NPC or creature
page shows its spots on a small map of its zone; later, a quest or object page does
the same. Artwork comes from the owner's installed client via wow.export (D-0019),
matched to zones by the map art file identifiers the add-on records.
Alternatives: an off-by-default "show positions" switch (rejected by the owner: too
many pins to be useful); clustering or heatmaps on the zone map (deferred; a page per
thing already answers "where").
Consequences: The zone page layout leads with the map; position data is reached
through the entity, never the zone.

## D-0041: Map art comes from Blizzard's content servers, laid out by the add-on, copied to our storage
Date: 2026-10-04  Status: accepted; narrows D-0019
Context: D-0019 had zone maps coming from an extraction tool the owner runs against
the installed client. In practice the tool crashed on the full export and showed
nothing on a narrower filter. Meanwhile the content servers the game itself
downloads from answer plain HTTPS requests with no sign-in (N-0020). The owner
wants the site to hold its own copies of every asset rather than reference
Blizzard's servers at page view.
Decision: The add-on records, for every map the client knows, which client files make
up the base map and where each explored-area picture is drawn (a client catalog,
like flight nodes). The site fetches each file once from Blizzard's content servers
using a per-build locator built offline, keeps the original file in our bucket,
composes the finished map, stores it as an image, and records it in `artwork`.
Pages serve only our copies; nothing on a page points at Blizzard. Composition runs
from the Admin page in small batches inside the site's own serverless function. The
owner never runs an extraction tool. Blizzard's API remains the first source for
icons and other media that it does serve (D-0019).
Alternatives: owner-run extraction (D-0019 path, rejected after it failed in
practice and because it does not survive patches without more owner labour);
reading the layout tables from the client data files (needs a parser for the
database format; the add-on already has the layout through documented API calls);
hot-linking Blizzard's servers (rejected by the owner, and the files for an old
build disappear after patches); a third-party mirror of client files (adds a
dependency on someone else's service).
Consequences: A new build needs a new locator file, produced by `tools/assets`
and committed; until then maps of that build are not composed. A zone map only
shows the areas some contributor has explored; it fills in as players explore.
Storage: a composed map is about 200 KB, a source tile about 35 KB; all of Classic
Era fits in well under a quarter of a gigabyte including source copies.

## D-0042: The helper has a small status window
Date: 2026-10-04  Status: accepted; refines D-0018
Context: docs/04 said the tray was the helper's only interface. First runs need
to show a sign-in code, confirm which game folder was found, and surface errors
in a way a non-technical player can read and report.
Decision: The helper keeps a single small window with sign-in state, the game
folder, the add-on version per client, and the last dozen activity lines. It
opens on first run and from the tray; closing it hides it. The tray menu stays
the way to drive the helper day to day. The helper also registers to start with
Windows, minimized, so syncing keeps working after a reboot.
Alternatives: tray only with native dialogs (hard to show a code and a log);
notifications only (disappear, cannot be read back).
Consequences: One window to keep in the design's register; the native side stays
tiny because the window is ordinary web content.

## D-0043: The site is the helper's dashboard
Date: 2026-10-04  Status: accepted
Context: With the helper installed, the Add-on page still led with the browser
folder steps, which cannot work under Program Files, so a player with a running
helper saw a page that looked broken and could not tell what the helper had done.
Decision: The helper reports its state to the site after every cycle and as a
twenty-second heartbeat: game folder, add-on version and link state per client,
last upload, last problem, paused, whether the game is running. The Add-on page
shows one card per signed-in helper with that state, refreshed every ten seconds,
and a button that asks the helper to act now (install or update the add-on if
needed, then sync); the helper picks the request up on its next heartbeat. When
at least one helper exists, the browser path is folded away under "Sync from this
page instead" and is never required. Revised the same day: writing the add-on's files is safe while the
game runs (the game reads add-ons at login), so nothing waits for the game to
close; a running game just needs a logout and login to load the new files. The
helper window and tray carry an explicit "Install or update the add-on" action
per client beside the automatic one.
Alternatives: detecting the helper from the browser (no clean way for a web page
to see a desktop app); a local port the site talks to (firewall prompts, mixed
content); keeping the browser steps visible (what the owner called friction).
Consequences: Four columns on `device_tokens` (helper version, state, last seen,
pending action), two endpoints, and the helper's heartbeat. A helper that never
reports shows as "signed in, has not reported yet".

## D-0044: Map layouts are bootstrapped from the client's own tables
Date: 2026-10-04  Status: accepted; extends D-0041
Context: D-0041 makes the add-on's catalog the source of each map's layout. That
catalog arrives only after a contributor syncs with add-on 0.3.0, which the
helper trouble delayed, so no zone page had a map. The same layout tables live
inside the client (UiMap, UiMapXMapArt, UiMapArt, UiMapArtStyleLayer,
UiMapArtTile, WorldMapOverlay, WorldMapOverlayTile) and wago.tools exports them
per build as plain CSV.
Decision: `tools/assets layouts` turns those tables into one layout file per
flavor and build, committed beside the locator. The composer uses the bootstrap
layout for every map of the build and merges in any pieces contributors' add-ons
recorded; the add-on catalog remains the live source and the only one stored as
facts. The layout file is artwork plumbing, never wiki data, like the file name
list.
Alternatives: wait for the first catalog sync (left every zone without a map
for as long as the helper was broken); parsing the client's database format
ourselves from the content servers (no third party, but a large parser for a
one-time export; worth doing if wago.tools ever goes away).
Consequences: Every Classic Era map (54) can be composed before anyone visits
it; a new build needs `layouts` re-run alongside `locator`.

## D-0045: Every zone exists from the start; flight paths live on the zone, not in a list
Date: 2026-10-04  Status: accepted
Context: Zone pages appeared only after a contributor visited, while the map
art for every Classic Era zone already existed (D-0044). Flight paths had a
sidebar category and a list page that nobody looks things up by.
Decision: The Zones index lists every map of the build from the client's layout
tables, grouped by continent, with its map; a zone no one has recorded says so
and fills in as uploads arrive. Flight paths have no category and no list
anywhere. On a zone page, flight masters are the one thing drawn on the zone map
(the game draws them too), each with the flight master's name and the
destinations reachable from there, as players saw on the flight map. A
character's known flight paths and the zones it has visited belong to the
Journal.
Alternatives: keep zones appearing on first visit (made the wiki look empty for
no reason); a flight paths list page (not how anyone looks for a flight).
Consequences: Zone names, parents and types for unvisited maps come from the
client tables, the same place the map art comes from, and are not stored as
facts; add-on captures replace them as they arrive. The add-on records routes,
the flight master and known nodes when the flight map opens (0.3.1). D-0040 gains
its one exception: flight masters on the zone map.

## D-0046: Zones are picked from the continent map
Status: superseded by D-0047. Rejected because rectangles overlap at the edges and
named zones with text on the map, and the page skipped the world map.

## D-0047: Zones are found by drilling down from the world map
Date: 2026-10-05  Status: accepted
Context: Supersedes D-0046. One page showing every continent's map with rectangles
and labels was busy, and the rectangles of neighbouring zones overlapped. The
owner asked for a drill-down: the world first, then a continent, then its zones,
with each clickable region shaped like the zone as drawn, no text over the map,
and the choices listed beside it.
Decision: `/wiki` shows the world map (Azeroth) with one clickable region per
continent, shaped like its drawn land, and the continents listed to the right
with their zone counts; battlegrounds, which hang off the world map, are listed
below the continents. `/wiki?continent=<id>` shows that continent's map with one
clickable region per zone, shaped like the zone, and the zones listed to the
right in map order (top to bottom, then left to right). Hovering a region or a
row highlights both; nothing is drawn or written on the map otherwise. Shapes are
build-specific artwork plumbing kept in the layout file beside the art layout:
a zone's shape is the outline of the union of its explored pieces, placed on the
continent through the world-coordinate boxes of both; a continent's shape on the
world map is traced from the drawn land colour. A zone without explored pieces
(cities, most battlegrounds) falls back to its box. How: N-0023.
Alternatives: rectangles with labels (D-0046; overlapping edges, text on the map);
a single page of every continent (busy, and no world map to start from); drawing
zone names on the map (owner: no text over the map; the list carries the names);
hand-drawn shapes (labour per build, and the client already draws the borders).
Consequences: Three clicks from the index to a zone (world, continent, zone), with
the breadcrumb and the right-hand list as the shortcut. The zone page's breadcrumb
reads Azeroth / continent / zone. Shapes are regenerated with the layout file at
each build; a zone whose explored pieces change shape moves with them.

