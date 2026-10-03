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
Verified: probe run 1 shows every `C_TooltipInfo.*` path as nil on era 1.15.9; probe
v2 exercises the hidden scan (pending).

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

## N-0004: LEARNED_SPELL_IN_TAB does not exist on Classic Era
Area: addon
Problem: Registering `LEARNED_SPELL_IN_TAB` throws "unknown event" on era 1.15.9.
Solution: Keep a set of known spell IDs from the spellbook (`GetNumSpellTabs`,
`GetSpellTabInfo`, `GetSpellBookItemInfo`). On `SPELLS_CHANGED` (throttled), diff
against the set; new IDs are `spell_learned` events. Attribute the source by the
most recent of: `TRAINER_UPDATE` with a purchase, `QUEST_TURNED_IN`, or a level-up in
the same second. Probe v2 also tests `LEARNED_SPELL_IN_SKILL_LINE` as a possible
replacement name.
Why: Event-name differences between flavors; the diff approach works everywhere.
Verified: probe run 1 `events["LEARNED_SPELL_IN_TAB"] = "unknown"`; `SPELLS_CHANGED`
fired 7 times in a session with two level-ups.

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

