# 03. Add-on Capture Specification

The add-on is a silent recorder. It captures two kinds of data:

- **World observations** (objective, for the World Wiki): what exists and what it is.
- **Journal events** (experiential, for the Journal): what happened to this character.

Every record is stamped with session context so the server can version and attribute it.
Items marked `VERIFY` still need confirmation in the live client. Facts established by
the probe (Classic Era 1.15.9, build 70003, US realm Mankrik, 2026-10-03) are marked
`VERIFIED` with the result; the raw probe output is kept under
`addon/WoWCompendiumProbe/results/`.

## Constraints we live with

- Add-ons cannot use the network, read or write arbitrary files, or access the
  clipboard. Output is only SavedVariables, written on logout, `/reload`, or exit.
- Add-ons cannot receive data while the game runs. Files written by the web app are
  read only at the next client start (the ack and link files).
- Hidden information is hidden: no spawn locations without seeing the spawn, no drop
  tables without loot windows, no quest text without viewing the quest.
- Item and spell data may not be cached when first referenced. Capture must retry on
  the cache-ready events.
- The client flavors expose different APIs. A compatibility layer isolates differences.

## Add-on architecture

```
core/
  init.lua        -- addon table, flavor detection, SavedVariables bootstrap
  compat.lua      -- per-flavor shims: one function per capability, nil if unsupported
  session.lua     -- session begin/end, sequence numbers, context stamp
  store.lua       -- in-memory journals, dedupe sets, counters, flush to SV
  ids.lua         -- GUID parsing, item link parsing, hashing
  throttle.lua    -- rate limiting for scans
  link.lua        -- reads Compendium_Link.lua (account binding)
  ack.lua         -- reads Compendium_Ack.lua, prunes acknowledged sessions
  login.lua       -- the single chat line at login
modules/
  units.lua       -- creatures, players seen
  quests.lua      -- quest log, detail/progress/complete text, rewards
  gossip.lua      -- gossip text and options
  vendors.lua     -- merchant inventories
  trainers.lua    -- trainer services
  loot.lua        -- loot windows, sources, drop counting
  items.lua       -- item info and tooltips
  spells.lua      -- spellbook, talents, auras, combat-log spells
  combat.lua      -- kills, deaths, encounters
  zones.lua       -- map, area, discovery, exploration
  taxi.lua        -- flight nodes and routes
  lore.lua        -- books, signs, pages (ITEM_TEXT)
  speech.lua      -- NPC say/yell/emote/whisper, scenes
  professions.lua -- skills, tradeskill and craft windows, recipes
  reputation.lua  -- faction list and changes
  character.lua   -- level, gear, played time, gold, titles
  social.lua      -- group members, inspects, guild
  collections.lua -- achievements, mounts, pets, toys (flavors that have them)
  journal_ej.lua  -- Encounter Journal dump (flavors that have it)
  pvp.lua         -- honorable kills, battlegrounds, duels
  mail.lua        -- mail received (Journal only)
```

Modules register against the event bus and call `store.observe(...)` or
`store.event(...)`. They never touch SavedVariables directly.

## Session context stamp

Captured once at `PLAYER_LOGIN` (and refreshed if any value could change):

| Field | Source |
|-------|--------|
| flavor | `WOW_PROJECT_ID` → `era`/`anniversary`/`mists`/`retail`/`forever`. `VERIFIED` era = 2; constants mainline 1, tbc 5, wrath 11, cata 14, mists 19. Anniversary detection: `VERIFY` (probably project 5 on the `_anniversary_` client). |
| build, patch | `GetBuildInfo()` `VERIFIED` → "1.15.9", "70003", "Sep 23 2026", 11509, "", "Release", 11509 |
| toc | `C_AddOns.GetAddOnMetadata(name, "X-Toc")`; `VERIFIED` era loads the `_Vanilla` TOC (`GetAddOnMetadata` global is absent) |
| locale | `GetLocale()` `VERIFIED` "enUS" |
| region | `GetCurrentRegion()` (1 US, 2 KR, 3 EU, 4 TW, 5 CN) and `GetCurrentRegionName()` `VERIFIED` 1, "US" |
| realm | `GetRealmName()`, `GetNormalizedRealmName()`, `GetRealmID()` `VERIFIED` 5149 for Mankrik; connected realms via `GetAutoCompleteRealms()` `VERIFIED` {Mankrik, Westfall, Ashkandi, Windseeker, Pagle} |
| hardcore | `C_GameRules.IsHardcoreActive()` `VERIFIED` on era (returned false on a normal realm) |
| season | `C_Seasons.HasActiveSeason()`, `C_Seasons.GetActiveSeason()` `VERIFIED` false / nil on a normal era realm |
| character | `UnitGUID("player")`, name, class, race, faction, level, sex |
| addon identity | UUID stored in account-wide SV, generated once |
| link | account token from `Compendium_Link.lua` if present |
| addon version | from TOC metadata |
| server time | `GetServerTime()` at login; all timestamps are server time |

Each session gets a monotonically increasing `seq` per character, persisted in SV. The
ack file carries the highest acknowledged `seq` per character GUID. At login the add-on
deletes sessions with `seq <= ack`. Unacknowledged sessions survive.

## World observations, by entity

Notation: `event → API → fields`. Dedupe key in brackets.

### Map art catalog (`zones.lua`)

A client catalog (D-0041), recorded once per session eight seconds after login for
every map from `C_Map.GetMapChildrenInfo(946, nil, true)` plus 946, and refreshed for
a map on each visit and after each discovery:

- Base layer: `C_Map.GetMapArtLayers(mapID)[1]` (`layerWidth`, `layerHeight`,
  `tileWidth`, `tileHeight`) and `C_Map.GetMapArtLayerTextures(mapID, 1)` (tile
  FileDataIDs, row-major), plus `C_Map.GetMapArtID`. Stored as `maps[id].art`.
  `VERIFIED` present on era 1.15.9; field names `VERIFY` on first real upload.
- Explored pieces: `C_MapExplorationInfo.GetExploredMapTextures(mapID)` entries
  (`textureWidth`, `textureHeight`, `offsetX`, `offsetY`, `fileDataIDs`). Stored as
  `maps[id].ovl`. Only what this character has explored; the server unions
  contributors.
- Maps without art (the cosmic map, some instances) throw inside the API; every call
  is pcall'd and the map is recorded without art.

### Flight map (`zones.lua`)

On `TAXIMAP_OPENED`: `C_TaxiMap.GetAllTaxiNodes(GetTaxiMapID())` (`VERIFIED` both
present on era 1.15.9; fields `VERIFY` on first real upload) gives every node with
`state` (0 current, 1 reachable, 2 unreachable), name and position. Recorded on
`taxiNodes[id]`: `known` for current and reachable nodes (Journal), `fm` (the
`npc` unit's npcID, the flight master) and `routes` (reachable node IDs) on the
current node (wiki facts `flight_master`, `taxi_route`). Positions and names are
refreshed for every node shown.

### Creatures (`units.lua`)

Sight: the client exposes nearby units only through nameplates (N-0016), and the
add-on never changes the player's nameplate or other settings (D-0036). Friendly NPC
coverage comes from mouseover, targeting, interaction, speech, and the combat log
during normal play.

Categories (D-0038): the wiki presents **NPCs** and **Creatures** as two separate
categories built from one `creature` entity type. A unit is an NPC when any of these
hold: it has an interaction role (vendor, trainer, quest giver, flight master, ...),
it has a tooltip subtitle other than "<Owner>'s Pet", it is a civilian, it cannot be attacked by the observer
(`UnitCanAttack`, recorded as `atk`), or any contributor saw it at reaction friendly or
better. Otherwise it is a Creature. Signals are unioned across contributors, so a
Horde guard seen as hostile by an Alliance player is still an NPC once a Horde player
reports it friendly or unattackable. Player pets (`Pet` GUIDs) and any unit for which
`UnitPlayerControlled` is true (totems, minions, companions, charmed units: these carry
`Creature` GUIDs) are never recorded; they belong to a player, not to the world.
`VERIFY` `UnitPlayerControlled` on era for a hunter pet and a totem. Ingest drops
`Pet` records from older add-ons as a second guard (N-0019).

Triggers: `PLAYER_TARGET_CHANGED`, `UPDATE_MOUSEOVER_UNIT`, `NAME_PLATE_UNIT_ADDED`,
`UNIT_TARGET` for party/raid targets, `GOSSIP_SHOW`/`MERCHANT_SHOW`/`QUEST_DETAIL`
(the interacted `npc` unit token), combat log source/dest GUIDs.

For each unit with a `Creature` or `Vehicle` GUID (`Pet` is skipped, D-0038):

- Identity: npcID, GUID type, spawn UID (for dedupe within session) `[npcID]`.
- Attributes: `UnitName`, `UnitLevel` (-1 means skull; record as `boss`),
  `UnitClassification` (normal/elite/rare/rareelite/worldboss/trivial/minus),
  `UnitCreatureType`, `UnitCreatureFamily`, `UnitReaction` relative to player faction
  (record with player faction so server can derive both sides), `UnitFactionGroup`,
  `UnitIsTapDenied`, `UnitPowerType`, `UnitHealthMax` and `UnitPowerMax` when the unit is
  at full health (`VERIFIED`: era returns real values for non-party creatures, e.g.
  Plainstrider level 2 = 55), `UnitSex`, `UnitIsCivilian` (`VERIFIED` present),
  `UnitIsPVP`.
- Subtitle (`<Weaponsmith>`, `<Flight Master>`): second tooltip line. `VERIFIED`:
  `C_TooltipInfo` does not exist on era 1.15, nor does `TooltipDataProcessor`. A
  hidden `GameTooltip` frame with `SetUnit` works for any unit (N-0001): lines are
  name, "Level N" or the subtitle ("Warrior Trainer", "Innkeeper", "Kodo Mounts"),
  faction ("Thunder Bluff"), "PvP". Players read "Level 10 Tauren Warrior (Player)".
- Roles: flags set by other modules when the same npcID is observed as vendor, trainer,
  quest giver, quest ender, flight master, innkeeper, banker, auctioneer, repairer,
  stable master, battlemaster, guild master, tabard vendor. Gossip options reveal many
  of these (`C_GossipInfo.GetOptions()` icon/type).
- Position: `C_Map.GetBestMapForUnit("player")` and
  `C_Map.GetPlayerMapPosition(mapID, "player")` (`VERIFIED` map 1412 Mulgore, x/y as
  fractions), plus `UnitPosition("player")` (`VERIFIED` world coordinates
  y, x, z, instanceID, e.g. -2357, -351.8, 0, 1) at the time of interaction or when the
  unit is within melee/interaction range (target distance checks via
  `CheckInteractDistance`, `VERIFIED` on era: false at range, true at a looted corpse;
  restricted in some flavors). Nameplate
  sightings record the player's position with a "nearby" flag rather than the unit's.
  Instance context from `GetInstanceInfo()`.
- Auras on the unit (`UNIT_AURA` → `C_UnitAuras.GetAuraDataByIndex`, `VERIFIED` present
  on era with the modern `UNIT_AURA` payload: `isFullUpdate`, `addedAuras`,
  `removedAuraInstanceIDs`; legacy `UnitAura` also works with spellID at return 10)
  → creature has spell.
- Casts by the unit (combat log `SPELL_CAST_START`, `SPELL_CAST_SUCCESS`, `SPELL_DAMAGE`,
  `SPELL_AURA_APPLIED` with creature source) → creature casts spell.
- Patrol/multiple positions: record each distinct position per spawn UID, throttled to
  one per 10 seconds and only when moved more than a threshold.

Players seen (other characters): name, realm, class, race, level, guild
(`GetGuildInfo`), title (`UnitPVPName`), faction. Recorded as Journal "players seen",
not as wiki entities, but their **guild names** and **title IDs** are wiki data (titles
are entities). Inspect data: see `social.lua`.

### Game objects (`units.lua`, `loot.lua`)

Game objects have no unit token. We observe them via:

- Loot source GUIDs (`GetLootSourceInfo`) of type `GameObject` → objectID, with the
  tooltip name captured at `LOOT_OPENED` if the object was moused over immediately
  before (`GameTooltip:GetUnit()` is nil for objects; take `GameTooltipTextLeft1` text
  on `UPDATE_MOUSEOVER_UNIT` when no unit exists; `VERIFY` for true objects, since
  the probe only caught units that way). `VERIFIED`: loot from a quest object came
  with source GUID `GameObject-0-5162-1-56-2912-...` (objectID 2912), so game objects
  are identified at loot time.
- Mining/herbalism/skinning/fishing: loot source type and the active spell cast
  (`UNIT_SPELLCAST_SUCCEEDED` for the player with gathering spell IDs) determine the
  gathering kind.
- `ITEM_TEXT_BEGIN` for readable objects (signs, books on tables).
- Position: player position at interaction (objects are interacted at close range).

### Quests (`quests.lua`)

- Quest log scan on `QUEST_LOG_UPDATE` (throttled): era uses `GetNumQuestLogEntries`,
  `GetQuestLogTitle(i)` (`VERIFIED`: 17 returns; index 4 isHeader, index 8 questID;
  headers are zone names such as "Red Cloud Mesa"), `SelectQuestLogEntry(i)` then
  `GetQuestLogQuestText()` (description, objectives),
  `GetNumQuestLeaderBoards(i)`/`GetQuestLogLeaderBoard(j, i)` (objective text, type,
  finished), `GetQuestLogRewardInfo`, `GetQuestLogRewardMoney`, `GetQuestLogRewardXP`
  (`VERIFIED` present), `GetQuestLogRequiredMoney`, `GetQuestLogTimeLeft`,
  `GetQuestLogGroupNum`. `VERIFIED` absent on era: `C_QuestLog.GetInfo`,
  `GetTitleForQuestID`, `GetAllCompletedQuestIDs`, `GetSelectedQuest`. `VERIFIED`
  present on era: `C_QuestLog.GetQuestObjectives`, `GetQuestInfo`,
  `IsQuestFlaggedCompleted`, `GetQuestsOnMap`. Mists/retail use `C_QuestLog.GetInfo`,
  `C_QuestLog.GetTitleForQuestID`. Zone header association from the log's header rows
  is captured as `log_header` (not authoritative zone).
- Quest giver: `QUEST_DETAIL` → `GetQuestID()`, `GetTitleText()`, `GetQuestText()`,
  `GetObjectiveText()` (`VERIFIED`), `GetRewardText()` (`VERIFIED` empty at detail
  stage, populated at `QUEST_COMPLETE`), rewards
  (`GetNumQuestRewards`, `GetNumQuestChoices`, `GetQuestItemLink("reward"|"choice", i)`,
  `GetQuestItemInfo`, `GetRewardMoney`, `GetRewardXP`, `GetRewardSpell`,
  `GetRewardTitle`, `GetRewardHonor`, `GetNumRewardCurrencies`; `GetRewardSpell`
  `VERIFIED` absent on era, replacement `VERIFY` in probe v2), plus the `npc` unit's
  GUID → quest **starts at** creature. `VERIFIED`: for an item-started quest,
  `UnitGUID("npc")` is nil and `UnitGUID("questnpc")` returns the item's GUID
  (`Item-<realm>-0-<id>`), so the start source is read from `questnpc` (N-0003).
- Progress text: `QUEST_PROGRESS` → `GetProgressText()`, required items
  (`GetNumQuestItems`, `GetQuestItemLink("required", i)`), `GetQuestMoneyToGet`.
- Completion: `QUEST_COMPLETE` → `GetRewardText()`, reward choices; npc GUID → quest
  **ends at** creature. `QUEST_TURNED_IN` (questID, xp, money) seals it.
- Greeting with multiple quests: `QUEST_GREETING` → `GetNumAvailableQuests`,
  `GetAvailableTitle(i)`, `GetAvailableQuestInfo(i)` (`VERIFIED` returns isTrivial,
  frequency, isRepeatable, isLegendary; no questID on era, so greeting entries are
  title-only until the player opens one and `QUEST_DETAIL` supplies the ID),
  `GetNumActiveQuests`, `GetActiveTitle(i)` (`GetActiveQuestID` `VERIFIED` absent). Gossip variant `VERIFIED` on era: `C_GossipInfo.GetAvailableQuests()`
  and `GetActiveQuests()` return tables with questID, title, isComplete, isTrivial,
  frequency, repeatable, questLevel; `C_GossipInfo.GetOptions()` returns name,
  gossipOptionID, icon (file ID), flags, status, orderIndex. Legacy `GetGossipText`
  and `GetGossipOptions` are absent.
- Prerequisites are not exposed. The server infers "quest B appeared available right
  after quest A turned in at the same NPC" as a weak hint, never a fact.
- Completed quest IDs: era uses `GetQuestsCompleted()` (table of questID → true;
  `C_QuestLog.GetAllCompletedQuestIDs` `VERIFIED` absent); newer flavors use
  `C_QuestLog.GetAllCompletedQuestIDs()`. Read at login and on `QUEST_TURNED_IN`
  (`VERIFIED` args: questID, xp, money). Journal state, and wiki existence evidence.
- Objective POIs are not available on era; on retail `C_QuestLog.GetQuestsOnMap`
  / `C_TaskQuest` are captured where present.

### Gossip (`gossip.lua`)

`GOSSIP_SHOW` → `C_GossipInfo.GetText()`, `GetOptions()` (name, icon/type, gossipOptionID
on newer clients), with npc GUID. Option selection (`C_GossipInfo.SelectOption` hook)
records the resulting text or window (vendor/trainer/taxi/bank/etc.) → gossip tree
edges. Dedupe `[npcID, hash(text)]`.

### Vendors (`vendors.lua`)

`MERCHANT_SHOW`, `MERCHANT_UPDATE` → `GetMerchantNumItems()`, per item
`GetMerchantItemInfo(i)` (`VERIFIED` on era: name, texture file ID, price, stackCount,
numAvailable (-1 unlimited), isPurchasable, isUsable, extendedCost), `GetMerchantItemLink(i)`, `GetMerchantItemCostInfo(i)` and
`GetMerchantItemCostItem(i, j)` for alternate currencies, `CanMerchantRepair()`.
Limited stock (`numAvailable >= 0`) recorded as a flag with observed count. Buyback is
ignored. Pagination: `MerchantFrame` shows pages; the APIs are index-based across all
items, so no paging needed. Dedupe `[npcID, itemID]` per session.

### Trainers (`trainers.lua`)

`TRAINER_SHOW`, `TRAINER_UPDATE` (`VERIFIED`: the service list is empty at
`TRAINER_SHOW`; scan on `TRAINER_UPDATE`, N-0002) → set filters to show all
(`SetTrainerServiceTypeFilter("available"|"unavailable"|"used", 1)`), then
`GetNumTrainerServices()`, `GetTrainerServiceInfo(i)` (name, rank, category, expanded),
`GetTrainerServiceCost(i)`, `GetTrainerServiceLevelReq(i)`, `GetTrainerServiceSkillReq(i)`,
`GetTrainerServiceItemLink(i)` / spell link, `GetTrainerServiceTypeFilter`. Restore the
player's filters afterward. Dedupe `[npcID, serviceSpellID]`.

### Loot and drops (`loot.lua`)

`LOOT_OPENED` → `GetNumLootItems()`, per slot `GetLootSlotType(i)` (item/money/currency),
`GetLootSlotInfo(i)` (`VERIFIED` on era the returns are shifted: 1 texture, 2 name,
3 quantity, 4 currencyID, 5 nil, 6 quality, 7 locked, 8 isQuestItem, 9 questID,
10 isActive; take quality from the item link instead, N-0007), `GetLootSlotLink(i)`,
`GetLootSourceInfo(i)` (`VERIFIED` GUID, quantity pairs for creatures and game
objects), `GetLootSlotType(i)` (`VERIFIED` 1 for items). `IsFishingLoot()`.

Server-side drop rate = (loot windows where item present) / (loot windows for that
source). To make the denominator correct the add-on records **every** loot window,
including empty ones and ones where nothing was taken, keyed by source GUID. One record
per spawn UID (opening the same corpse twice counts once). Area-loot (retail) attaches
items to the right sources via `GetLootSourceInfo`. Quest items are flagged so rates
can be computed conditioned on "player on quest" (`isQuestItem`, `questID`).

Gathering kind (skin/mine/herb/fish/pickpocket/disenchant/prospect/mill/salvage) from
the most recent player spell cast success before the window.

Journal: `loot` events for the player's own received items (`CHAT_MSG_LOOT` parsing:
`VERIFIED` text form "You receive loot: <link>.", 17 arguments, player name at 5,
line ID at 11, no GUID at 12; `LOOT_SLOT_CLEARED` fires per slot; `ITEM_PUSH`
`VERIFIED` (bagSlot, iconFileID)), money looted (`CHAT_MSG_MONEY`, `VERIFIED` "You
loot 4 Copper").

### Items (`items.lua`)

Any item link seen anywhere (loot, vendor, quest reward, bags, equipment, inspect,
trade, mail, chat) is queued. On `GET_ITEM_INFO_RECEIVED` or immediately if cached:
`GetItemInfo` → name, quality, itemLevel, requiredLevel, class, subclass, maxStack,
equipLoc, iconFileID, sellPrice, classID, subclassID, bindType, expansionID, setID,
isCraftingReagent. Tooltip lines via hidden-tooltip scan on era (`C_TooltipInfo`
absent, N-0001) and `C_TooltipInfo.GetItemByID` where it exists: stats, effects ("Use:", "Equip:",
"Chance on hit:"), set name and bonuses, durability, "Unique", binding, class/race
requirements, item spell IDs where exposed (`GetItemSpell`). Item link parts (random
suffix ID, enchant, bonus IDs, level) are preserved as **instance** attributes separate
from the base item. Dedupe `[itemID, suffixID]` per session; tooltip captured once per
base item per session.

Container contents (`BAG_UPDATE` → `C_Container.GetContainerItemInfo`; `VERIFIED`
`C_Container` present on era and legacy `GetContainerItemInfo` absent) feed item
discovery and Journal inventory snapshots at logout only.

### Spells and auras (`spells.lua`)

- Player spellbook on `SPELLS_CHANGED` (throttled): era `GetNumSpellTabs`,
  `GetSpellTabInfo`, `GetSpellBookItemInfo(index, "spell")` (`VERIFIED`: returns
  "SPELL", spellID), `GetSpellBookItemName`; retail `C_SpellBook.*` (`VERIFIED` absent
  on era). Spell learning: `LEARNED_SPELL_IN_SKILL_LINE` (`VERIFIED` on era: spellID,
  skillLineIndex, isGuildPerk; `LEARNED_SPELL_IN_TAB` is absent), with a spellbook
  diff on `SPELLS_CHANGED` as the cross-flavor fallback (N-0004). Record spell IDs,
  ranks (era), tab (class/profession).
- Spell details on first sight of any spell ID: `GetSpellInfo`/`C_Spell.GetSpellInfo`
  (name, icon, castTime, minRange, maxRange), `GetSpellDescription`,
  `C_TooltipInfo.GetSpellByID` for tooltip text (cost, range, cooldown, description).
- Talents: era `GetTalentInfo(tab, index)` (`VERIFIED`: name, icon, tier, column,
  rank, maxRank, ..., and a 12th return that looks like a talent ID) and
  `GetTalentTabInfo`; mists talents and glyphs; retail `C_Traits`/`C_ClassTalents`. Snapshot at login and on change events.
  Wiki gets the talent tree definitions; Journal gets the character's choices.
- Auras on player and party (`UNIT_AURA`) → spell existence and aura text.
- All combat-log spell IDs (any source) → spell existence with school and name.

### Combat, kills, deaths, encounters (`combat.lua`)

`COMBAT_LOG_EVENT_UNFILTERED` → `CombatLogGetCurrentEventInfo()`.

- **Kills**: `UNIT_DIED` / `PARTY_KILL` where dest is a creature and the player or their
  group dealt damage to that GUID in the last N seconds (track a short damage map).
  Journal `kill` event with npcID, position, group size. Also increments the loot
  denominator candidate (a kill without a loot window opened is still a kill).
- **Deaths**: `PLAYER_DEAD` → Journal `death` with killer (last source to damage the
  player: npcID or player or environmental type), position, level, zone, whether in
  instance, whether Hardcore (`hardcore_death`). `PLAYER_ALIVE`/`PLAYER_UNGHOST` close
  the death record with spirit-release and resurrection method where inferable.
- **Encounters**: `ENCOUNTER_START` (encounterID, name, difficultyID, groupSize),
  `ENCOUNTER_END` (... success), `BOSS_KILL` (`VERIFIED` registerable on era) → wiki
  encounter entity and instance association; Journal `encounter_*` events with
  duration and group composition. `VERIFY` they fire in era dungeons; fallback is
  `UNIT_DIED` of the final-boss npcID list, filled by observation.
- `VERIFIED` combat-log shapes on era: `PARTY_KILL` carries the player's GUID as
  source; `UNIT_DIED` has an empty source; `SPELL_CAST_SUCCESS` from creatures gives
  spellID, name, school (e.g. Boar Charge 3385 school 1).
- Creature abilities and damage profile (which spells a creature casts, melee damage
  range vs. player level) are wiki facts. Raw damage numbers are **not** stored.

### Zones and exploration (`zones.lua`)

- `ZONE_CHANGED_NEW_AREA`, `ZONE_CHANGED`, `ZONE_CHANGED_INDOORS` → `GetZoneText`,
  `GetSubZoneText`, `GetRealZoneText`, `GetMinimapZoneText`, `C_Map.GetBestMapForUnit`,
  `C_Map.GetMapInfo(mapID)` (name, mapType, parentMapID), `IsIndoors`, `IsResting`,
  `GetInstanceInfo`. Wiki: map hierarchy, subzone names with positions (the player's
  position when the subzone text changes gives boundary samples). Journal: `zone_enter`.
- Discovery: `UI_INFO_MESSAGE` matching the localized "Discovered: %s" pattern plus XP
  gained → Journal `area_discovered`; wiki: area exists with discovery XP by level.
- Exploration state: `C_MapExplorationInfo.GetExploredMapTextures(mapID)` (`VERIFIED`
  present on era, returns overlay texture records) and
  `C_MapExplorationInfo.GetExploredAreaIDsAtPosition(mapID, pos)` (`VERIFIED` present;
  gives explored area IDs at a position, resolvable with `C_Map.GetAreaInfo`);
  snapshot per zone at logout → Journal exploration percentage per zone.
- PvP zone status, world PvP objectives (`GetNumWorldPVPAreas`) where present.
- Instance maps: `GetInstanceInfo` on enter → instance entity (name, type, difficulty,
  maxPlayers, instanceID, group ID), Journal `instance_enter`.

### Flight paths (`taxi.lua`)

`C_TaxiMap.GetTaxiNodesForMap(mapID)` `VERIFIED` on era returns the whole continent's
node catalog without opening the flight map (35 nodes from Mulgore: nodeID, name
"Thunder Bluff, Mulgore", position, faction, isUndiscovered, atlasName). That is a
client catalog (D-0006) and gives every node's name and position at once; the
Journal's "discovered" state comes from `isUndiscovered` (N-0008).
`TAXIMAP_OPENED` → `NumTaxiNodes()`, per node `TaxiNodeName(i)`, `TaxiNodePosition(i)`,
`TaxiNodeGetType(i)` (CURRENT/REACHABLE/DISTANT), `TaxiNodeCost(i)`, `GetNumRoutes(i)`,
`TaxiGetSrcX/Y`, `TaxiGetDestX/Y` for route segments, flight master npc GUID. On
`TakeTaxiNode` hook: Journal `taxi_flight` with source, destination, cost, duration
(measured until `PLAYER_CONTROL_GAINED`). Wiki: node graph, costs, measured durations.

### Lore text (`lore.lua`)

`ITEM_TEXT_BEGIN`/`ITEM_TEXT_READY` → `ItemTextGetItem()` (title), `ItemTextGetCreator()`,
`ItemTextGetMaterial()`, `ItemTextGetPage()`, `ItemTextGetText()`, `ItemTextHasNextPage()`.
Capture every page the player views; the add-on does **not** auto-page (that would be
gameplay interference). Source: the moused-over object or the item used
(last `C_Container.UseContainerItem` hook; legacy `UseContainerItem` `VERIFIED` absent
on era) `VERIFY`. Position recorded for in-world objects.
Dedupe `[hash(title, page, text)]`.

Also: quest item text shown in `QuestFrame` for items that start quests (covered by
quests), mail bodies from NPCs (`mail.lua`), and gossip text (covered above).

### NPC speech and scenes (`speech.lua`)

`CHAT_MSG_MONSTER_SAY`, `_YELL`, `_EMOTE`, `_WHISPER`, `CHAT_MSG_RAID_BOSS_EMOTE`,
`CHAT_MSG_RAID_BOSS_WHISPER` → text, speaker name, language, target name, sender GUID
(argument 12; `VERIFIED` nil for `CHAT_MSG_MONSTER_EMOTE` on era, so attribution for
emotes is by speaker name resolved against recently seen creature names; `VERIFY`
for say and yell in probe v2). Record `speech_line` [npcID, kind, hash(text)] with
position and the player's position.

**Scenes**: consecutive speech lines from one or more NPCs within a sliding window
(default 30 seconds between lines, same zone) are grouped into a scene with ordered
lines and relative timestamps. The server merges scenes across contributors by line
set. Trigger context is recorded when inferable: a quest turn-in within 5 seconds
before the first line, a gossip option selected, an encounter start, or none
(ambient). Player-directed text (text containing the player's name) is normalized by
replacing the name with a placeholder token before hashing, and the raw form is kept
only in the Journal.

### Professions and recipes (`professions.lua`)

- Skills: era `GetNumSkillLines`, `GetSkillLineInfo(i)` (name, isHeader, isExpanded,
  rank, numTempPoints, modifier, maxRank, isAbandonable, stepCost, rankCost, minLevel,
  skillCostType, description); `GetProfessions`/`GetProfessionInfo` (`VERIFIED` also
  present on era). Journal `skill_up` on `CHAT_MSG_SKILL` (`VERIFIED` "Your skill in
  Defense has increased to 10.") and `SKILL_LINES_CHANGED` deltas.
- Tradeskill window: `TRADE_SKILL_SHOW`/`TRADE_SKILL_UPDATE` → era `GetNumTradeSkills`,
  `GetTradeSkillInfo(i)` (name, type/difficulty, numAvailable), `GetTradeSkillItemLink(i)`,
  `GetTradeSkillRecipeLink(i)`, `GetTradeSkillNumMade(i)`, `GetTradeSkillNumReagents(i)`,
  `GetTradeSkillReagentInfo(i, j)`, `GetTradeSkillReagentItemLink(i, j)`,
  `GetTradeSkillCooldown(i)`, `GetTradeSkillTools(i)`; era enchanting uses `CRAFT_SHOW`,
  `GetNumCrafts`, `GetCraftInfo`, `GetCraftReagentInfo`, `GetCraftItemLink`,
  `GetCraftDescription` (`VERIFIED` all present on era; `C_TradeSkillUI` absent).
  Mists/retail use `C_TradeSkillUI`. Wiki: recipe (craft spell)
  → product item with quantity range, reagents with counts, skill line, difficulty
  color at observed skill (gives orange/yellow/green/grey thresholds over many
  observations). Journal: known recipes.
- Recipe sources (trainer, vendor, drop, quest) come from the other modules via the
  recipe item or craft spell ID.

### Reputation (`reputation.lua`)

`UPDATE_FACTION` (throttled) → era `GetNumFactions`, `GetFactionInfo(i)` (`VERIFIED`
16 returns: name, description (lore text, e.g. the Darkspear Trolls paragraph),
standingID, barMin, barMax, barValue, atWarWith, canToggleAtWar, isHeader,
isCollapsed, hasRep, isWatched, isChild, factionID at 14, hasBonusRepGain,
canSetInactive);
retail `C_Reputation.GetFactionDataByIndex` (`VERIFIED` absent on era). Wiki: factions,
descriptions, hierarchy. Journal: standing snapshots and `rep_change` from
`CHAT_MSG_COMBAT_FACTION_CHANGE` (`VERIFIED` "Your Thunder Bluff reputation has
increased by 150.", same server second as `QUEST_TURNED_IN`) with the cause when
inferable (quest turned in within 2 seconds, kill of npcID within 2 seconds) → wiki:
quest gives rep, creature gives rep.

### Character (`character.lua`)

Login snapshot and change events: level (`PLAYER_LEVEL_UP` → `level_up`; `VERIFIED`
args on era: level, healthDelta, powerDelta, talentPoints, pvpTalentSlots, then
strength, agility, stamina, intellect, spirit deltas), gear (`PLAYER_EQUIPMENT_CHANGED` →
`item_equipped` with slot and item link; full equipment snapshot at login/logout),
gold (`PLAYER_MONEY` → `gold_change` deltas aggregated per minute with cause when
inferable: loot, vendor, quest, mail, trade, repair, taxi), played time
(`RequestTimePlayed` at login, `TIME_PLAYED_MSG` `VERIFIED` (total, thisLevel),
suppressing the default chat print), titles (`KNOWN_TITLES_UPDATE`, `GetNumTitles`,
`GetTitleName`), honor/HKs (`GetPVPLifetimeStats`, `UnitPVPRank`, `GetPVPRankInfo`
`VERIFIED` present on era), rested state, hearth location (`GetBindLocation`),
guild membership and rank, bank contents at bank open (Journal only), talents.

### Social (`social.lua`)

- Group: `GROUP_ROSTER_UPDATE` → members (name, realm, class, level, guild), group type,
  instance; Journal `group_joined`/`group_left`. Players recorded by name+realm; a
  players-seen table per account in the Journal.
- Inspect: `INSPECT_READY` (guid) → `GetInventoryItemLink(unit, slot)` for all slots,
  talents of the inspected unit where exposed. Journal `inspect_player` (the user
  chose to inspect; we record what they saw). Item links feed wiki item discovery.
- Guild: own guild roster is **not** captured (out of scope: guild management).
- Chat from players is **not** captured. Only NPC channels (speech module).

### Collections and achievements (`collections.lua`)

Flavors with achievements (mists, retail, anniversary from Wrath phase onward):
`GetCategoryList`, `GetCategoryInfo`, `GetCategoryNumAchievements`, `GetAchievementInfo`
(id, name, points, completed, month, day, year, description, flags, icon, rewardText,
isGuild, wasEarnedByMe, earnedBy), `GetAchievementNumCriteria`,
`GetAchievementCriteriaInfo` (criteriaString, criteriaType, completed, quantity,
reqQuantity, charName, flags, assetID, quantityString), `GetNextAchievement`,
`GetPreviousAchievement`. (`VERIFIED` on era: the functions exist, `GetCategoryList`
returns 7 categories, `GetAchievementInfo(6)` returns nothing; treat era as having no
achievement catalog.) Full dump at login (throttled across frames), delta on
`ACHIEVEMENT_EARNED` and `CRITERIA_UPDATE`. Wiki: the achievement catalog per flavor
and build. Journal: completion and criteria progress. Statistics (`GetStatistic`) are
Journal only.

Retail collections: `C_MountJournal`, `C_PetJournal`, `C_ToyBox`,
`C_TransmogCollection`, `C_Heirloom`: catalog to wiki, ownership to Journal.

### Encounter Journal dump (`journal_ej.lua`)

Retail and mists: `EJ_*`/`C_EncounterJournal` enumerate tiers, instances, encounters,
sections (abilities with descriptions), and loot. This is client-held data read
directly from the client and is an observation like any other (D-0006). Records carry
source `client_catalog` for provenance only; they are not displayed differently.

### PvP (`pvp.lua`)

`PLAYER_PVP_KILLS_CHANGED`/`CHAT_MSG_COMBAT_HONOR_GAIN` → `honorable_kill`;
`UPDATE_BATTLEFIELD_STATUS`, `PVP_MATCH_COMPLETE` or `UPDATE_BATTLEFIELD_SCORE` at end
→ `bg_complete` (battleground, winner, duration, own stats); `DUEL_FINISHED`
`VERIFY` winner detection → `duel`. Wiki: battleground instances. Journal: the rest.

### Mail (`mail.lua`)

`MAIL_INBOX_UPDATE` → `GetInboxHeaderInfo(i)` sender, subject, money, COD, days left,
item count; `GetInboxText(i)` only when the player opens the mail (hook `InboxFrame`
open, not `GetInboxText` on scan). NPC senders (quest reward mail, event mail) → wiki
lore text with sender npc name. Player mail: Journal `mail_received` header only, body
never stored.

## Journal events: summary table

| Kind | Trigger | Payload highlights |
|------|---------|--------------------|
| login/logout | `PLAYER_LOGIN`, `PLAYER_LOGOUT` | zone, level, played time, gold |
| level_up | `PLAYER_LEVEL_UP` | level, zone, position, played time |
| death | `PLAYER_DEAD` | killer, zone, position, level, hardcore flag |
| kill | combat log | npcID, group size, zone |
| quest_accept/complete/abandon | `QUEST_ACCEPTED`, `QUEST_TURNED_IN`, `QUEST_REMOVED` | questID, npcID, zone, xp, money |
| area_discovered | `UI_INFO_MESSAGE` | areaID/name, xp |
| zone_enter | zone events | mapID |
| first_sighting | derived at store time | entity type and id (first time this account saw it) |
| loot | loot/chat | itemID, quantity, source, gathering kind |
| gold_change | `PLAYER_MONEY` | delta, cause |
| rep_change | faction chat | factionID, delta, cause |
| skill_up | skill chat | skillLineID, new rank |
| spell_learned | `LEARNED_SPELL_IN_TAB` | spellID, source (trainer/quest/level) |
| talent_change | talent events | snapshot |
| item_equipped | equipment change | slot, item link |
| encounter_start/end | encounter events | encounterID, difficulty, group, success, duration |
| instance_enter | zone events | instanceID, difficulty |
| taxi_flight | taxi hook | from, to, cost, duration |
| trainer_purchase | `TRAINER_UPDATE` delta / chat | spellID, cost |
| vendor_purchase/sale | `MERCHANT_UPDATE` + bag/money deltas | itemID, quantity, price |
| fish_caught | loot with fishing flag | itemID, zone |
| honorable_kill | pvp events | count |
| bg_complete | battleground end | bg, result, stats |
| duel | `DUEL_FINISHED` | opponent, result |
| achievement_earned | `ACHIEVEMENT_EARNED` | achievementID |
| inspect_player | `INSPECT_READY` | name, realm, items |
| group_joined/left | roster | members |
| mail_received | inbox | sender, subject, items (no body) |
| hardcore_death | `PLAYER_DEAD` in hardcore | as death, final |

## What the add-on never records

- Player chat in any channel (say, party, guild, whisper, trade, general).
- Guild roster, guild bank, calendar.
- Auction house listings (deferred, not never).
- Raw per-hit combat numbers.
- The WoW account name, email, or any Battle.net identifier other than the BattleTag,
  which is recorded only in the Journal and never shared without opt-in.
- Anything from other add-ons' SavedVariables.

## Performance rules

- Every scan is throttled; no work on every frame. Combat log handling is table
  lookups only.
- Dedupe sets are per session and keyed as noted; repeated sightings only bump
  counters.
- Tooltip scans are done once per entity per session and never during combat unless
  the data is combat-only (aura/cast capture uses the combat log, not tooltips).
- Memory: journals are flat arrays of small tables; strings are interned by Lua.
- Logout: no serialization work. SavedVariables are native Lua tables written by the
  client. The browser-side parser handles the Lua literal format.

## SavedVariables layout

Account-wide variable `WoWCompendiumDB` (declared in each TOC):

```lua
WoWCompendiumDB = {
  schema = 1,                   -- bumped with every incompatible change
  addon_version = "0.1.0",
  identity = "uuid",
  link = { account_token = "...", linked_at = 0 },   -- copied from link file
  ack = { ["Player-xxxx-yyyy"] = 17 },               -- copied from ack file
  characters = {
    ["Player-xxxx-yyyy"] = {
      meta = { name, realm, region, class, race, faction, flavor },
      next_seq = 18,
      sessions = {
        [18] = {
          ctx = { build, patch, locale, hardcore, season, started, ended },
          world = { creatures = {...}, items = {...}, quests = {...}, ... },
          events = { {t, kind, ...}, ... },
          state = { completed_quests = {...}, explored = {...}, ... },
        },
      },
    },
  },
}
```

Per-character SavedVariables are not used; everything lives in the account-wide file so
the sync module reads one file per WoW license per flavor.

## Login chat line

Exactly one line, once per login, no color spam, prefixed `WoW Compendium:`. Content:

- If unacknowledged sessions exist: "N sessions not yet synced. Open <site> to sync, or
  install the sync helper to do it automatically."
- If the link file is missing: "Not linked to an account. Open <site> to link."
- Otherwise: nothing. Silence is the default.

## Verification status

Probe runs 1 and 2 (Classic Era 1.15.9, 2026-10-03) settled:

| Item | Result |
|------|--------|
| `C_TooltipInfo`, `TooltipDataProcessor`, `TooltipUtil` on era | Absent. Hidden tooltip scan is the method (N-0001). |
| `C_UnitAuras.GetAuraDataByIndex` on era | Present, with modern `UNIT_AURA` payload. |
| `C_MapExplorationInfo` on era | Present: `GetExploredMapTextures` and `GetExploredAreaIDsAtPosition`. |
| `UnitHealthMax` for non-party creatures on era | Real values. |
| `GetRewardText` timing | Empty at `QUEST_DETAIL`, populated at `QUEST_COMPLETE`. |
| `GetAvailableQuestInfo` on era | Present. |
| `GetPVPLifetimeStats` on era | Present. |
| `C_GossipInfo` on era | Modern API present; legacy gossip functions absent. |
| `C_Container` on era | Present; legacy container functions absent. |
| `C_QuestLog.GetAllCompletedQuestIDs` on era | Absent; use `GetQuestsCompleted()`. |
| `LEARNED_SPELL_IN_TAB` on era | Unknown event. |
| `HARDCORE_DEATH`, `PVP_MATCH_COMPLETE`, `SEASON_INFO_UPDATE`, `QUEST_DATA_LOAD_RESULT` on era | Unknown events. |
| `GetRewardSpell` on era | Absent. |
| `CHAT_MSG_MONSTER_EMOTE` sender GUID (arg 12) on era | Nil. Attribute by name. |
| Trainer list at `TRAINER_SHOW` | Empty; populated by `TRAINER_UPDATE`. |
| Item-started quests | `UnitGUID("questnpc")` returns the item GUID. |
| `PLAYER_INTERACTION_MANAGER_FRAME_SHOW` types seen | 3 quest/gossip, 5 merchant, 7 trainer. |
| `C_GameRules.IsHardcoreActive`, `C_Seasons` on era | Present. |
| Achievement, mount, pet, toy, Encounter Journal functions on era | Present but empty: 7 achievement categories with no achievements, 0 mounts, 0 journal tiers. |
| Hidden tooltip scan on era | Works for units, items (`SetHyperlink`, `SetItemByID`), spells (`SetHyperlink`, `SetSpellByID`), inventory. |
| `GetLootSourceInfo` for game objects | Returns `GameObject-...` GUIDs. |
| `GetLootSlotInfo` return order on era | Shifted; quality at 6, locked 7, isQuestItem 8 (N-0007). |
| `LEARNED_SPELL_IN_SKILL_LINE` on era | Fires (spellID, skillLineIndex, isGuildPerk). |
| `C_TaxiMap.GetTaxiNodesForMap` on era | Full continent node catalog without the flight map open. |
| `UnitPosition("player")` on era | World coordinates available. |
| `C_MapExplorationInfo.GetExploredAreaIDsAtPosition` on era | Returns area IDs; `C_Map.GetAreaInfo` resolves names (222 = Bloodhoof Village). |
| `C_QuestLog.GetQuestObjectives(questID)` on era | Structured objectives: text, type, numFulfilled, numRequired, finished. |
| `C_QuestLog.GetQuestInfo(questID)` on era | Returns the title. |
| `GetAvailableQuestInfo` on era | isTrivial, frequency, isRepeatable, isLegendary; no questID. |
| `CHAT_MSG_LOOT` GUID (arg 12) on era | Nil. |
| `WOW_PROJECT_ID`, build, TOC on era | 2, 70003 (1.15.9, interface 11509), `_Vanilla`. |

Still open, to be settled by the real add-on's debug output during normal play:

1. `ENCOUNTER_START`/`END` firing in era dungeons and raids (needs a dungeon run).
2. `CHAT_MSG_MONSTER_SAY`/`YELL` argument 12 (only an emote was observed; it had no GUID).
3. Replacement for `GetRewardSpell` on era (none of the candidate names existed in
   probe v2's list; check `GetRewardSpellInfo`-style names when a spell-reward quest
   is viewed).
4. Live tooltip text for true game objects (chests, herbs, veins) on mouseover.
5. `TAXIMAP_OPENED` did not fire while `TAXIMAP_CLOSED` did once; confirm the event
   name on era when a flight map is actually opened.
6. Anniversary client: TOC suffix, project ID, build (run the probe there when a
   character exists).
