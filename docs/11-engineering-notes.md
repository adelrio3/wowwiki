# 11. Engineering Notes

Solved problems, recorded so they are never solved twice. Each entry is a problem a
future session would otherwise rediscover: a client quirk, a library gotcha, a
non-obvious reason the code is shaped the way it is. Design lives in `00` to `08`;
choices live in `09`; this file holds the "how, exactly, and why that way".

Format:

```
## N-NNNN: Short title
Area: addon | sync | ingest | db | web | helper | assets
Problem: what went wrong or what was non-obvious.
Solution: what we do, precisely, with file and function names.
Why: why this and not the obvious thing.
Verified: how we know it works (test name, probe result, date).
```

Entries are added in the same commit as the code that embodies them. An entry that no
longer matches the code is a bug in one or the other.

---

## N-0001: No C_TooltipInfo on Classic Era; scan a hidden GameTooltip
Area: addon
Problem: The modern tooltip data API (`C_TooltipInfo`, `TooltipDataProcessor`,
`TooltipUtil`) does not exist on Classic Era 1.15.9. Item stats, unit subtitles, and
spell text are only available as rendered tooltip lines.
Solution: Create one hidden tooltip frame once:
`CreateFrame("GameTooltip", "WoWCompendiumTip", UIParent, "GameTooltipTemplate")`.
For each scan: `SetOwner(UIParent, "ANCHOR_NONE")`, `ClearLines()`, then one of
`SetUnit(unit)`, `SetHyperlink("item:ID")`, `SetItemByID(id)`, `SetSpellByID(id)`,
`SetHyperlink("spell:ID")`, `SetInventoryItem`, `SetBagItem`, `SetLootItem`,
`SetMerchantItem`, `SetTrainerService`. Read `_G["WoWCompendiumTipTextLeft"..i]` and
`TextRight` for `i = 1 .. tip:NumLines()`, then `Hide()`. Wrap the setter in `pcall`;
some setters error on uncached items, in which case retry on
`GET_ITEM_INFO_RECEIVED` / `ITEM_DATA_LOAD_RESULT`.
Why: The only text source on era. The frame must be hidden and separately named so it
never interferes with the player's real tooltip.
Verified: probe run 1 shows every `C_TooltipInfo.*` path as nil on era 1.15.9. Probe
run 3 (v2) confirms the hidden scan returns full lines for units (name, level or
subtitle, faction, PvP), items via `SetHyperlink("item:6948")` and `SetItemByID`,
spells via `SetHyperlink("spell:8690")` and `SetSpellByID` (which also shows the
player's remaining cooldown, so prefer the hyperlink form for wiki text), and
`SetInventoryItem` (damage, speed, durability).

## N-0002: Trainer service list is empty at TRAINER_SHOW
Area: addon
Problem: `GetNumTrainerServices()` returned 0 inside the `TRAINER_SHOW` handler even
though the trainer window then showed services.
Solution: Scan on `TRAINER_UPDATE` (fires several times after show), deduping by
service spell ID within the window session; close the scan on `TRAINER_CLOSED`.
Why: The client requests the list from the server after the frame opens.
Verified: probe run 1, hunter trainer Lanka Farshot: `TRAINER_SHOW` n=0, then nine
`TRAINER_UPDATE` events.

## N-0003: Item-started quests expose the item through the "questnpc" unit
Area: addon
Problem: When a quest is started from an item, `QUEST_DETAIL` fires with no `npc`
unit, and the `questStartItemID` argument was 0 on era.
Solution: Read `UnitGUID("questnpc")`. For an item it returns an `Item-<realm>-0-<id>`
GUID; for a creature it returns the creature GUID. Treat an `Item` GUID as "quest
starts from item" and resolve the item by matching recent `C_Container.UseContainerItem`
calls (hooked with `hooksecurefunc`) or the last bag item link used.
Why: There is no other signal on era.
Verified: probe run 1, quest 781 "Attack on Camp Narache": `questitemGUID =
Item-5149-0-400000032551FC36`, `npcGUID = nil`, `questStartItemID = 0`.

## N-0004: Spell learning on Classic Era uses LEARNED_SPELL_IN_SKILL_LINE
Area: addon
Problem: Registering `LEARNED_SPELL_IN_TAB` throws "unknown event" on era 1.15.9.
Solution: Register `LEARNED_SPELL_IN_SKILL_LINE` (args: spellID, skillLineIndex,
isGuildPerk) on every flavor; it is the current name. Keep a spellbook diff on
`SPELLS_CHANGED` as a fallback for any flavor where the event is missing. The system
chat line "You have learned a new spell: Arcane Shot (Rank 1)." carries the rank text
that the event does not. Attribute the source by the most recent of: `TRAINER_UPDATE`
with a purchase, `QUEST_TURNED_IN`, or a level-up in the same second.
Why: Event-name differences between flavors; the diff approach works everywhere.
Verified: probe run 1 `events["LEARNED_SPELL_IN_TAB"] = "unknown"`; probe run 3
`LEARNED_SPELL_IN_SKILL_LINE` fired with (3044, 3, false) for Arcane Shot.

## N-0005: Monster emote has no sender GUID on Classic Era
Area: addon
Problem: `CHAT_MSG_MONSTER_EMOTE` argument 12 (sender GUID) was nil for an emote from
Greatmother Hawkwind; argument 11 (line ID) was present.
Solution: Attribute speech by speaker name against the creature names seen in the
last 60 seconds (nameplates, target, mouseover) in the current zone; if exactly one
npcID matches, attribute to it; otherwise store the line with name only and let the
server resolve by consensus. Keep the line ID: it is stable per server text and
useful as a dedupe key. Check say/yell separately (probe v2).
Why: The client simply does not send the GUID for emotes on this flavor.
Verified: probe run 2, `speech_emote` sample.

## N-0006: Probe SavedVariables must not cap table keys on snapshots
Area: addon
Problem: A size guard that truncated tables to 24 keys silently dropped the build
info, project ID, and locale from the login snapshot because `pairs()` order is
arbitrary.
Solution: Separate limits per record kind: samples at 64 keys and depth 5, login and
constants at 500 keys and depth 6. Record the essential constants in their own small
table immediately at `PLAYER_LOGIN`, before any delayed snapshot.
Why: Essentials must never compete with optional detail for a size budget.
Verified: run 1 `login["..."] = true` with the essentials missing; fixed in probe v2.


## N-0007: GetLootSlotInfo returns are shifted by one on Classic Era
Area: addon
Problem: The documented order is texture, name, quantity, currencyID, quality,
locked, isQuestItem, questID, isActive. On era 1.15.9 the values observed were:
1 texture, 2 name, 3 quantity, 4 nil, 5 nil, 6 quality (0 for Rabbit's Foot, 1 for
Stringy Wolf Meat), 7 locked, 8 isQuestItem (true for Ambercorn).
Solution: Do not depend on positional returns for quality or quest flags. Take the
item ID and quality from `GetLootSlotLink(i)` (the link color encodes quality and
`GetItemInfo` gives it exactly), and read isQuestItem as the first boolean after the
quality number by scanning returns 6 through 10. Keep the probe's raw sample as the
regression fixture.
Why: Positional APIs drift between flavors; links do not.
Verified: probe run 3, `loot` samples 1 through 5.

## N-0008: Flight node catalog is available without opening the flight map
Area: addon
Problem: Capturing flight paths only when the player opens a flight master would take
months to cover the world.
Solution: Call `C_TaxiMap.GetTaxiNodesForMap(C_Map.GetBestMapForUnit("player"))` at
login and on `ZONE_CHANGED_NEW_AREA`. On era it returns the whole continent's nodes
(35 from Mulgore): nodeID, name ("Thunder Bluff, Mulgore"), position (map fraction),
faction, isUndiscovered, atlasName. Record nodes as a client catalog observation and
`isUndiscovered = false` as the Journal's discovered state. Routes and costs still
need the map open (`TAXIMAP_OPENED`, `GetNumRoutes`, `TaxiNodeCost`).
`C_TaxiMap.GetAllTaxiNodes` returns 0 when the map is closed.
Why: Full node coverage on day one; the catalog is client data (D-0006).
Verified: probe run 3 login snapshot.

## N-0009: World coordinates come from UnitPosition
Area: addon
Problem: Map-relative positions from `C_Map.GetPlayerMapPosition` depend on which map
the client picks, which changes at zone borders and in subzones with their own maps.
Solution: Record `UnitPosition("player")` (y, x, z, instanceID) alongside the map
pair for every positioned observation. Cluster spawn points in world space on the
server; convert to any map with `C_Map.GetMapPosFromWorldPos` when needed.
Why: One coordinate system per continent; no border artifacts.
Verified: probe run 3, `unitPosition = {-2357, -351.8, 0, 1}` in Bloodhoof Village.

## N-0010: Explored area IDs resolve to subzone names on Classic Era
Area: addon
Problem: Exploration achievements need a stable identity per subzone; zone text is
localized and not unique.
Solution: `C_MapExplorationInfo.GetExploredAreaIDsAtPosition(mapID, pos)` returns
area IDs at the player's position (222 at Bloodhoof Village); `C_Map.GetAreaInfo(id)`
returns the localized name. Record area IDs on every `ZONE_CHANGED` and at login; the
Journal's explored set is a set of area IDs, and the wiki's area entity is keyed by
area ID with names per locale.
Why: Area IDs are the same across locales and flavors where the area exists.
Verified: probe run 3, login and `zoneChanged` samples.

## N-0011: Ingest runs inline and is resumable from the status endpoint
Area: ingest
Problem: Netlify background functions are not available on every plan, and a
separate worker is more than 0.x needs. But a serverless request has a time limit,
and an upload must never be lost to a timeout.
Solution: `POST /api/sync/upload` stores the raw file and the `uploads` row (status
`received`) first, then runs `ingestUpload()` inline. `GET /api/sync/status` re-runs
`ingestUpload()` whenever it finds a row still at `received`, or at `ingesting` for
more than five minutes. `ingestUpload()` is idempotent: sessions are keyed by
(character, seq) and skipped when present, so a resumed ingest never double counts.
Why: Correctness without infrastructure; the raw file is the source of truth.
Verified: `apps/web/src/lib/server/ingest/ingest.test.ts` covers the pure parts;
end-to-end verified by the owner's first sync (pending).

## N-0012: Testing SvelteKit server code outside the app
Area: web
Problem: Server modules import `$env/dynamic/private` and `$lib/...`, which only
resolve inside the SvelteKit build, so vitest at the repository root could not load
them.
Solution: `vitest.config.ts` aliases `$env/dynamic/private` to
`apps/web/test/env-stub.ts` (which exposes `process.env`) and `$lib` to
`apps/web/src/lib`. Keep server logic in plain modules with pure functions
(`observationsFor`, `computeFacts`, `computePositions`) so it is testable without a
database.
Why: One test command for the whole repository.
Verified: `pnpm test` runs 23 tests across packages and the app.

## N-0013: Workspace packages are consumed as TypeScript source
Area: web
Problem: Building every package before the app adds a step and a place for stale
output to hide.
Solution: Each package's `package.json` points `main`, `types`, and `exports` at
`./src/index.ts`. Vite, vitest, and Netlify's esbuild bundler all compile linked
TypeScript directly. Subpath entry points (like the browser adapter) must be listed
in `exports`, or Vite refuses the deep import.
Why: No build step for packages; one source of truth.
Verified: `pnpm build` succeeds; the deep import failure before adding
`./browser` to `exports` is the regression to watch for.

## N-0014: The client has no math.randomseed
Area: addon
Problem: The first real-client run produced a SavedVariables file with no
`identity`, and the site rejected it as unparseable. `ids.uuid()` called
`math.randomseed`, which exists in standard Lua and in the test mock but not in the
game client, so the identity line threw and the rest of initialization never ran.
Solution: Never call `math.randomseed` (the client seeds itself); guard any optional
standard-library function with an existence check. `initDb()` now assigns `NS.db`
first, generates the identity inside `pcall` with a never-nil fallback, and errors
thrown before the database exists are kept and copied into `db.errors` once it does,
so the next failure of this kind is visible in the uploaded file.
Why: The mock must match the client's missing functions as well as its present ones;
initialization must degrade, never abort.
Verified: `addon/tests/mock_wow.lua` now removes `math.randomseed`; the suite passes
with the fix and fails without it. Owner's second sync (pending).

## N-0015: The "npc" unit token goes stale; quest events must use "questnpc"
Area: addon
Problem: The first real sync showed the Thunder Bluff flight master with roles
"bank, gossip, quest, quest_end, taxi". Two causes: the interaction-type table had
taxi and bank swapped (Enum.PlayerInteractionType: 6 is TaxiNode, 8 is Banker), and
`UnitExists("npc")` stays true after an interaction window closes, so a later quest
event (from an item, or another NPC) was attributed to the last NPC talked to.
Solution: Quest events (`QUEST_GREETING`, `QUEST_DETAIL`, `QUEST_PROGRESS`,
`QUEST_COMPLETE`, interaction type 4) read `UnitGUID("questnpc")` and only assign a
role when it is a creature GUID; an Item GUID means an item-started quest and no NPC
is credited. Other interaction events keep using "npc", which the client sets fresh
when that window opens.
Why: Attribution errors become wrong wiki facts that only consensus can dilute.
Verified: `addon/tests/run.lua` "stale npc never gets quest roles"; owner's next sync.

## N-0016: Nearby units are only visible through nameplates, and we do not change that
Area: addon
Problem: The owner noticed that NPCs standing nearby were not recorded unless
clicked or hovered. The client has no API to enumerate units in view; the only
"nearby" channel is nameplates (`NAME_PLATE_UNIT_ADDED`), and friendly NPC
nameplates are off by default, so villages full of NPCs go unrecorded until someone
hovers or talks to them.
Solution: None that changes the client. The add-on must never alter nameplate
CVars or any other client setting (D-0036). Coverage of friendly NPCs comes from
mouseover, targeting, interaction, speech, and combat log events during normal
play, across many contributors. The link file's `settings` table exists for future
capture tuning but holds nothing today.
Why: Non-invasive is a product rule; slower coverage is accepted.
Verified: `addon/tests/run.lua` asserts `SetCVar` is never called.

## N-0017: Chrome blocks folder access under Program Files
Area: sync
Problem: The owner had to move the game out of its default install location
before the site could read it. Chromium's File System Access API refuses the
directory picker for a blocklist of system locations, and Program Files (with all
of its children) is on it. Battle.net installs World of Warcraft under
`C:\Program Files (x86)\World of Warcraft` by default, so most Windows players
cannot use the browser path at all without moving the game.
Solution: The browser path stays for players whose install is elsewhere; the Sync
page explains the limit when the picker fails or returns a folder with no client
directories. The helper (a native app) has no such restriction and is the primary
path for Windows users; its schedule moves up accordingly (docs/08). Moving the
game folder is supported by Battle.net ("Locate" after a move) and is documented
on the Sync page as the no-install alternative.
Why: A platform restriction, not something the site can work around.
Verified: Owner's report, 2026-10-04; Chromium's blocklist behavior.

## N-0018: Unlayered CSS beats Tailwind utilities
Area: web
Problem: The first design shipped buttons whose text was the same color as their
background. A plain `a { color: var(--accent) }` rule in `app.css` sat outside any
cascade layer, and unlayered styles outrank everything inside `@layer`, so Tailwind's
`text-accent-ink` on button links never applied.
Solution: All element defaults go inside `@layer base { ... }`. Custom utilities use
`@utility`. The page audit (`apps/web/scripts/check-pages.mjs`, mock data, both
themes, two widths, WCAG AA) runs before any visual change is deployed; it catches
this class of bug mechanically.
Why: Cascade layers make unlayered rules win regardless of specificity.
Verified: audit output before and after the fix (46 problems to 0).

## N-0019: A capture rule enforced only in the add-on does not hold
Area: add-on, ingest
Problem: D-0038 excluded player pets by changing the add-on. Five pets captured by
the previous add-on version were already in the database, and the read-time NPC
classifier then counted their "<Owner>'s Pet" subtitle as a person, so the pets
moved from the Creatures table to the NPCs table instead of disappearing.
Solution: Every "never record X" rule is enforced in three places: the add-on (so it
is not captured), ingest (so uploads from older add-ons and re-ingested raw files
cannot bring it back), and a data migration for what already landed. The classifier
ignores subtitles ending in "'s Pet", which also covers NPC-owned pets that carry
`Creature` GUIDs and are legitimately creatures.
Why: Add-on versions in the field lag the site, and raw uploads are retained and
re-ingested. The add-on is the first filter, never the only one.
Verified: ingest test drops a `Pet` record; classifier test; live facts query
showed exactly the five pet entities that migration 0002 targets.
