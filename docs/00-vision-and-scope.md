# 00. Vision and Scope

## One sentence

WoW Compendium preserves the world of World of Warcraft, as it was at every point in
time, using only what real players' clients saw, and gives each player a record of
their own journey through it.

## Two products, one add-on

### The World Wiki (universal data)

A public, read-only encyclopedia of everything that exists in the game world: creatures,
items, quests, spells, zones, dungeons, vendors, trainers, recipes, flight paths, lore
text, NPC speech, and so on. Every fact in it was observed by our add-on running in a
real player's client. We do not import from any other source. We are building our own
source of truth.

The wiki is **versioned**. The same item has different stats in Classic Era and Retail,
and the same quest may have different text across patches. We record facts against the
exact client build they were observed in, and present them to readers collapsed by
expansion.

The wiki is **crowdsourced and consensus-based**. A fact reported by one account is shown
as unconfirmed. A fact reported by two or more independent accounts is confirmed. An
administrator can override and correct, with every override audited.

Long term, the wiki's data must be robust enough to stand as a general-purpose public
database of the game. We will not market it that way at first, but we design the data
for it.

### The Journal (account and character data)

A private-by-default record of one player's experience: characters, levels, deaths,
kills, quests completed, zones discovered, first sightings, loot received, dungeons run,
reputation gained, professions, and more. The Journal exists for enjoyment: anything a
player would think is cool to see about their own history.

On top of the Journal sits an **achievement system** that mirrors Blizzard's in-game
achievements as closely as possible where they exist, and reconstructs the Wrath-era
achievement set for Classic Era where they do not. Players can opt in to public
profiles and leaderboards.

### The add-on

A silent background recorder. It has no in-game interface. It captures everything the
client can see and everything the player interacts with, and stores it in the client's
SavedVariables file. The web app installs, updates, and removes the add-on, and reads
its output, through the browser's folder access.

## Principles

1. **Our own source of truth.** Universal data enters only through our add-on. Artwork
   is the one exception and is handled separately.
2. **Objective goes to the wiki, experiential goes to the Journal.** "Hogger is level 11
   elite in Elwynn Forest" is wiki. "You died to Hogger on March 3rd" is Journal. "Hogger
   dropped 3 items across your 7 kills" is Journal; "Hogger drops item X with rate Y%
   across all contributors" is wiki.
3. **Preserve, don't interpret.** Record what was seen with full provenance. Derive
   conclusions in a separate layer that can be recomputed.
4. **Versioned by build, displayed by expansion.** Track as finely as the data allows.
   Readers choose an expansion and see that expansion's values; nothing finer than
   expansion is shown outside admin tools.
5. **Provenance over bulk.** Every fact can be traced to the accounts and builds that
   reported it. Retention of raw uploads and of individual observations is bounded
   (limits under decision; see `10` item A).
6. **Private by default.** Nothing about a player is visible to other people using the
   site until they say so.
7. **Non-invasive, two ways.** The browser does the work when the user opens the site,
   with no install. An optional helper application does the same work in the
   background for users who prefer not to open the site. Both are first-class from the
   first release and share one code path. In game, the add-on never changes a
   setting or asks the player to play differently (D-0036).
8. **Multi-user from day one.** Even though one person tests first, every table,
   policy, and flow assumes many accounts and untrusted input.
9. **Design before code.** Documents first. Decisions logged. Code follows.

## In scope

- Capture of all static world entity types the client exposes (see `03`).
- Capture of experiential events for the Journal (see `03`, `06`).
- Support for every current client: Classic Era (including Hardcore), Anniversary,
  Mists Classic, and Retail. Classic Era first, because the owner plays it.
- Localized capture: strings recorded with their client locale.
- Browser-based install, update, removal, and sync of the add-on (Chromium browsers).
- The helper: an optional desktop application that installs, updates, and syncs in the
  background. With it, any browser works.
- Manual fallback for other browsers without the helper: download the add-on, drag in
  the data file.
- Consensus and trust model, administrator overrides with auditing.
- Achievement mirroring and Classic Era reconstruction, progress tracking, opt-in
  leaderboards.
- Hooks for cosmetics and titles (schema only; features deferred).
- Artwork from Blizzard's official API and media servers first, and from our own
  extraction pipeline for what the API does not provide, such as zone maps (see `01`).
- Use of Blizzard's Game Data API beyond artwork is under decision (see `10` item C).

## Out of scope

- Any gameplay assistance: rotation helpers, boss mods, auction tools, automation.
- Anything that violates Blizzard's add-on policy or terms of service.
- Importing data from Wowhead or community data dumps. (Blizzard's own API: see `10`
  item C.)
- Guild management or raid logistics.
- Monetization.
- Offline use of the web app.
- Supporting more than one Compendium account per person (one account rolls up all
  their characters across all flavors and WoW licenses).
- An in-game UI for the add-on.
- A required desktop component. The helper is optional.

## Deferred (planned, not now)

- Cosmetics and titles unlocked by achievements.
- Auction house and economy data.
- Public API for third parties.

## Success criteria for the first release

1. The owner logs into Classic Era and plays normally.
2. On logout, the add-on has recorded every creature, quest, item, zone, vendor,
   trainer, gossip, lore text, and NPC speech encountered, plus the owner's own
   experiential events.
3. The owner opens the site in Chrome. It detects new data, uploads it, and the wiki
   shows pages for what was seen, marked unconfirmed, with correct build and locale.
4. The Journal shows the owner's characters, timeline, kills, deaths, quests, and
   achievement progress including Loremaster and exploration.
5. A second person can install the add-on from the site and their observations
   confirm the owner's.

## Glossary

Use these words exactly, in docs and code.

| Term | Meaning |
|------|---------|
| **Flavor** | Which game client: `era` (Classic Era incl. Hardcore and seasonal; folder `_classic_era_`), `anniversary` (Burning Crusade Anniversary; folder `_anniversary_`), `mists` (Mists of Pandaria Classic; folder `_classic_`), `retail` (folder `_retail_`), `forever` (WoW: Forever, launching 2026-11-04; beta folder `_classic_beta_`, launch folder unknown). Derived from the client, never guessed. |
| **Build** | The client build number from `GetBuildInfo()`. The finest version grain we record. |
| **Patch** | Human-readable version such as `1.15.7`. Mapped from build via our own lookup table. |
| **Expansion** | What readers see: Classic, Burning Crusade, Wrath, ... Mapped from flavor and patch. |
| **Phase** | For progression and Anniversary realms, the content unlock stage. Realm-and-time dependent. |
| **Upload** | One raw SavedVariables file received from a user. Immutable. |
| **Session** | One login-to-logout span of one character, as recorded by the add-on. |
| **Observation** | One normalized record extracted from an upload: "contributor C, in build B, locale L, saw entity E with field F = value V at time T." Immutable. |
| **Fact** | An aggregated statement about an entity field across contributors and builds, with a status. |
| **Status** | `unconfirmed` (one contributor), `confirmed` (two or more), `disputed` (conflicting), `retired` (no longer observed in later builds), `overridden` (admin). |
| **Override** | An administrator correction layered on top of facts. Always audited. |
| **World Wiki** | The public, universal, read-only product built from facts. |
| **Journal** | The per-account, per-character experiential product. |
| **Contributor** | A Compendium account, as the source of observations. |
| **Character** | One in-game character, identified by its player GUID plus name, realm, region, flavor. |
| **Entity** | A thing in the world with a stable in-game ID: creature, item, quest, spell, zone, etc. |
| **Scene** | A recorded sequence of NPC speech lines that occurred together in one place and time window. |
| **Lore text** | Readable in-world text: books, signs, plaques, letters, pages. |
| **Ack file** | The small Lua file the web app writes into the add-on folder to tell the add-on what has been uploaded. |
| **Link file** | The Lua file the web app writes to bind the add-on's output to a Compendium account. |
| **Helper** | The optional desktop application that syncs in the background. Never required. Same code as the browser sync module behind a different file adapter. |
| **Sync core** | The shared package that reads, parses, hashes, uploads, and writes ack/link files, used by both the browser and the helper. |
