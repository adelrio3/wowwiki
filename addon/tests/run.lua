-- Minimal test runner for the add-on's pure logic. Run: lua5.1 addon/tests/run.lua
package.path = "addon/tests/?.lua;" .. package.path
local mock = require("mock_wow")
local out = print -- keep the real print; the mock captures the add-on's
mock.install()

local ADDON = "WoWCompendium"
local ROOT = "addon/WoWCompendium/"
local FILES = {
  "Compendium_Link.lua", "Compendium_Ack.lua",
  "core/init.lua", "core/compat.lua", "core/ids.lua", "core/throttle.lua", "core/store.lua",
  "core/session.lua", "core/link.lua", "core/ack.lua", "core/login.lua",
  "modules/units.lua", "modules/zones.lua", "modules/items.lua", "modules/loot.lua", "modules/vendors.lua",
}

local NS
local function loadAddon()
  NS = {}
  _G.WoWCompendiumDB = nil
  for _, f in ipairs(FILES) do
    local chunk, err = loadfile(ROOT .. f)
    assert(chunk, err)
    chunk(ADDON, NS)
  end
  return NS
end

local passed, failed = 0, 0
local function test(name, fn)
  local ok, err = pcall(fn)
  if ok then passed = passed + 1 out("ok   " .. name)
  else failed = failed + 1 out("FAIL " .. name .. "\n     " .. tostring(err)) end
end
local function eq(a, b, msg)
  if a ~= b then error((msg or "mismatch") .. ": expected " .. tostring(b) .. ", got " .. tostring(a), 2) end
end

local function player()
  mock.units.player = { guid = "Player-5149-04E14735", name = "Eigan", level = 5, className = "Hunter", classFile = "HUNTER", classId = 3,
    race = "Tauren", raceFile = "Tauren", raceId = 6, factionGroup = "Horde", sex = 2, health = 100, healthMax = 100 }
end

local function login()
  mock.fire("ADDON_LOADED", ADDON)
  mock.fire("PLAYER_LOGIN")
  mock.fire("PLAYER_ENTERING_WORLD", true, false)
  mock.runTimers()
end

test("ids.parse handles creature, player, item, and junk", function()
  loadAddon()
  local c = NS.ids.parse("Creature-0-5162-1-56-2955-0000405A7D")
  eq(c.kind, "Creature"); eq(c.id, 2955); eq(c.spawn, "0000405A7D"); eq(c.instance, 1)
  eq(NS.ids.parse("GameObject-0-5162-1-56-2912-000040695B").id, 2912)
  eq(NS.ids.parse("Player-5149-04E14735").realm, 5149)
  eq(NS.ids.parse("Item-5149-0-400000032551FC36").kind, "Item")
  eq(NS.ids.parse("nope"), nil)
  assert(string.match(NS.ids.uuid(), "^%x%x%x%x%x%x%x%x%-%x%x%x%x%-4%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x$"), "uuid shape")
end)

test("unknown events are recorded, not fatal", function()
  loadAddon()
  NS.on("LEARNED_SPELL_IN_TAB", function() end)
  assert(NS.unknownEvents.LEARNED_SPELL_IN_TAB, "recorded")
  assert(mock.registered.PLAYER_LOGIN, "known events registered")
end)

test("login creates the character, a session with seq 1, and the db identity", function()
  loadAddon(); player(); login()
  local db = WoWCompendiumDB
  eq(db.schema, 1); assert(db.identity and #db.identity == 36, "identity")
  local char = db.characters["Player-5149-04E14735"]
  assert(char, "character created")
  eq(char.meta.name, "Eigan"); eq(char.meta.flavor, "era"); eq(char.meta.classId, 3)
  eq(char.nextSeq, 2)
  local s = char.sessions["1"]
  assert(s, "session 1"); eq(s.ctx.build, 70003); eq(s.ctx.version, "1.15.9"); eq(s.ctx.locale, "enUS"); eq(s.ctx.realmId, 5149)
  eq(s.events[1].k, "login"); eq(s.events[1].m, 1412)
  eq(s.state.level, 5); eq(s.state.money, 67)
end)

test("second login increments seq and logout finalizes", function()
  loadAddon(); player(); login()
  mock.fire("PLAYER_LOGOUT")
  local s1 = WoWCompendiumDB.characters["Player-5149-04E14735"].sessions["1"]
  assert(s1.ctx.ended, "ended stamped"); eq(s1.events[#s1.events].k, "logout")
  -- simulate next client start: reload files with the same SavedVariables
  local saved = WoWCompendiumDB
  loadAddon(); _G.WoWCompendiumDB = saved; player(); login()
  local char = WoWCompendiumDB.characters["Player-5149-04E14735"]
  eq(char.nextSeq, 3); assert(char.sessions["2"], "session 2")
end)

test("ack file prunes acknowledged sessions and the login line reports the rest", function()
  loadAddon(); player(); login()
  local guid = "Player-5149-04E14735"
  for _ = 1, 3 do mock.fire("PLAYER_LOGOUT"); local saved = WoWCompendiumDB; loadAddon(); _G.WoWCompendiumDB = saved; player(); login() end
  local char = WoWCompendiumDB.characters[guid]
  local n = 0 for _ in pairs(char.sessions) do n = n + 1 end
  eq(n, 4, "four sessions before ack")
  -- server acknowledged up to seq 2
  _G.COMPENDIUM_ACK = { [guid] = 2 }
  mock.fire("PLAYER_LOGOUT"); local saved = WoWCompendiumDB
  mock.printed = {}
  loadAddon(); _G.WoWCompendiumDB = saved; player(); login()
  char = WoWCompendiumDB.characters[guid]
  assert(not char.sessions["1"] and not char.sessions["2"], "1 and 2 pruned")
  assert(char.sessions["3"] and char.sessions["4"] and char.sessions["5"], "3, 4 kept, 5 current")
  eq(WoWCompendiumDB.ack[guid], 2)
  assert(string.find(mock.printed[1], "Not linked"), "unlinked line first: " .. tostring(mock.printed[1]))
  _G.COMPENDIUM_LINK = { account_token = "tok_abc", linked_at = 1 }
  mock.fire("PLAYER_LOGOUT"); saved = WoWCompendiumDB; mock.printed = {}
  loadAddon(); _G.WoWCompendiumDB = saved; player(); login()
  eq(WoWCompendiumDB.link.accountToken, "tok_abc")
  assert(string.find(mock.printed[1], "3 sessions not yet synced"), "pending line: " .. tostring(mock.printed[1]))
  _G.COMPENDIUM_LINK = {}; _G.COMPENDIUM_ACK = {}
end)

test("size guard strips world data from the oldest unacked sessions", function()
  loadAddon(); player(); login()
  local char = WoWCompendiumDB.characters["Player-5149-04E14735"]
  for i = 2, 70 do char.sessions[tostring(i)] = { seq = i, ctx = {}, world = { creatures = {} }, events = {}, state = {} } end
  char.nextSeq = 71
  local stripped = NS.session_api.sizeGuard(char)
  eq(stripped, 10)
  assert(char.sessions["1"].worldStripped and not char.sessions["1"].world, "oldest stripped")
  assert(char.sessions["70"].world, "newest intact")
end)

test("targeting a creature records it once per spawn with health, tooltip, and position", function()
  loadAddon(); player(); login()
  mock.units.target = { guid = "Creature-0-5162-1-56-3063-00003DC5F0", name = "Krang Stonehoof", level = 14, classification = "normal",
    creatureType = "Humanoid", reaction = 5, health = 500, healthMax = 500, powerType = 1, powerMax = 0, sex = 2 }
  mock.tooltips.target = { "Krang Stonehoof", "Warrior Trainer", "Thunder Bluff" }
  mock.fire("PLAYER_TARGET_CHANGED")
  mock.fire("PLAYER_TARGET_CHANGED")
  local c = NS.session.world.creatures["3063"]
  assert(c, "creature recorded"); eq(c.name, "Krang Stonehoof"); eq(c.n, 2); eq(c.sp, 1); eq(c.lmin, 14); eq(c.lmax, 14)
  eq(c.hp["14"], 500); eq(c.sub, "Warrior Trainer"); eq(c.tf, "Thunder Bluff"); eq(c.rx, 5); eq(c.ct, "Humanoid")
  eq(#c.pos, 1); eq(c.pos[1].k, "target"); eq(c.pos[1].wx, -351.8)
  -- a second spawn of the same npc adds a spawn and a position
  mock.units.target.guid = "Creature-0-5162-1-56-3063-00003DC5F1"
  mock.mapPos = { x = 0.6, y = 0.8 }
  mock.fire("PLAYER_TARGET_CHANGED")
  eq(c.sp, 2); eq(#c.pos, 2)
  -- damaged units do not record health
  mock.units.target = { guid = "Creature-0-5162-1-56-2958-0000407711", name = "Prairie Wolf", level = 6, health = 10, healthMax = 90, reaction = 2 }
  mock.fire("PLAYER_TARGET_CHANGED")
  eq(NS.session.world.creatures["2958"].hp, nil)
  -- players and player pets are ignored
  mock.units.target = { guid = "Player-5149-04E19732", name = "Rhinhaus", level = 10 }
  mock.fire("PLAYER_TARGET_CHANGED")
  eq(NS.session.world.creatures["Rhinhaus"], nil)
  mock.units.target = { guid = "Pet-0-5162-1-56-2955-00009999AA", name = "Bitey", level = 5, health = 1, healthMax = 1 }
  mock.fire("PLAYER_TARGET_CHANGED")
  eq(NS.session.world.creatures["2955"], nil, "pets never recorded")
  mock.units.target = { guid = "Creature-0-5162-1-56-5929-00009999AB", name = "Stoneclaw Totem", level = 5, health = 1, healthMax = 1, playerControlled = true }
  mock.fire("PLAYER_TARGET_CHANGED")
  eq(NS.session.world.creatures["5929"], nil, "player-controlled creatures never recorded")
  -- attackable flag recorded
  mock.units.target = { guid = "Creature-0-5162-1-56-3222-0000000001", name = "Brave Wildrunner", level = 14, health = 1, healthMax = 1, attackable = false, reaction = 5 }
  mock.fire("PLAYER_TARGET_CHANGED")
  eq(NS.session.world.creatures["3222"].atk, false)
end)

test("interaction frames add roles to the npc; stale npc never gets quest roles", function()
  loadAddon(); player(); login()
  mock.units.npc = { guid = "Creature-0-5162-1-56-3081-00003BCC1A", name = "Wunna Darkmane", level = 10, health = 1, healthMax = 1 }
  mock.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", 5)
  mock.fire("MERCHANT_SHOW")
  local c = NS.session.world.creatures["3081"]
  assert(c.roles.vendor, "vendor role"); eq(c.pos[1].k, "interact")
  mock.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", 6)
  assert(c.roles.taxi, "6 is taxi"); assert(not c.roles.bank, "6 is not bank")
  -- an item-started quest while the stale npc token still points at Wunna
  mock.units.questnpc = { guid = "Item-5149-0-400000032551FC36", name = "A letter" }
  mock.fire("QUEST_DETAIL")
  assert(not c.roles.quest, "stale npc must not become a quest giver")
  -- a real quest giver
  mock.units.questnpc = { guid = "Creature-0-5162-1-56-2981-00003BCC18", name = "Chief Hawkwind", level = 10, health = 1, healthMax = 1 }
  mock.fire("QUEST_DETAIL")
  assert(NS.session.world.creatures["2981"].roles.quest, "questnpc gets the quest role")
  mock.units.questnpc = nil
end)

test("locating records map, area, zone text, taxi catalog, explored set, and zone_enter", function()
  loadAddon(); player(); login()
  local w = NS.session.world
  eq(w.maps["1412"].name, "Mulgore"); eq(w.maps["1412"].parent, 1414)
  eq(w.areas["222"].name, "Bloodhoof Village"); eq(w.areas["222"].zone, "Mulgore")
  assert(w.zoneTexts["Mulgore/Bloodhoof Village"], "zone text")
  eq(w.taxiNodes["22"].name, "Thunder Bluff, Mulgore"); eq(w.taxiNodes["22"].undiscovered, false)
  eq(NS.session.state.explored[1], 222)
  local kinds = {}
  for _, e in ipairs(NS.session.events) do kinds[e.k] = (kinds[e.k] or 0) + 1 end
  eq(kinds.zone_enter, 1); eq(kinds.login, 1)
  -- moving to a new subzone with a new area id
  mock.subzone = "Red Cloud Mesa"; mock.areaIDs = { 221 }; mock.areaNames[221] = "Red Cloud Mesa"
  mock.fire("ZONE_CHANGED")
  eq(w.areas["221"].name, "Red Cloud Mesa"); eq(#NS.session.state.explored, 2)
  mock.subzone = "Bloodhoof Village"; mock.areaIDs = { 222 }
end)

test("login catalogs every map's art layout and this character's explored pieces", function()
  loadAddon(); player(); login()
  mock.runTimers()
  local maps = NS.session.world.maps
  assert(maps["1412"] and maps["1412"].art, "Mulgore has art")
  eq(maps["1412"].art.w, 1002); eq(maps["1412"].art.tw, 256); eq(#maps["1412"].art.t, 12); eq(maps["1412"].art.t[1], 141201); eq(maps["1412"].art.aid, 6412)
  eq(#maps["1412"].ovl, 1); eq(maps["1412"].ovl[1].x, 300); eq(maps["1412"].ovl[1].t[1], 272173)
  assert(maps["1414"] and maps["1414"].art, "Kalimdor has art"); eq(maps["1414"].ovl, nil)
  assert(maps["946"] and not maps["946"].art, "cosmic map recorded without art, no error")
  eq(NS.session.errors and #NS.session.errors or 0, 0)
end)

test("opening the flight map records routes, known nodes, and the flight master", function()
  loadAddon(); player(); login()
  mock.units.npc = { guid = "Creature-0-5162-1-56-2995-00003DC5F0", name = "Tal", level = 55, reaction = 5, health = 1, healthMax = 1 }
  mock.fire("TAXIMAP_OPENED")
  local n = NS.session.world.taxiNodes
  assert(n["22"] and n["22"].known, "current node known"); eq(n["22"].fm, 2995); eq(n["22"].routes["25"], true); eq(n["22"].routes["23"], nil)
  assert(n["25"].known, "reachable node known"); eq(n["23"].known, nil); eq(n["23"].name, "Orgrimmar, Durotar"); eq(n["25"].m, 1414)
end)

test("discovery messages become area_discovered events", function()
  loadAddon(); player(); login()
  mock.fire("CHAT_MSG_SYSTEM", "Discovered Brambleblade Ravine: 25 experience gained")
  local ev = NS.session.events[#NS.session.events]
  eq(ev.k, "area_discovered"); eq(ev.d.name, "Brambleblade Ravine"); eq(ev.d.xp, 25)
  mock.fire("UI_INFO_MESSAGE", 299, "Battleboar Flank: 1/8")
  eq(NS.session.events[#NS.session.events].k, "area_discovered", "quest progress must not add events")
end)

test("level up, death, and played time land in the journal and state", function()
  loadAddon(); player(); login()
  mock.fire("PLAYER_LEVEL_UP", 6, 17, 8, 0, 0, 1, 1, 0, 1, 0)
  mock.fire("PLAYER_DEAD")
  mock.fire("TIME_PLAYED_MSG", 15610, 3453)
  local st = NS.session.state
  eq(st.level, 6); eq(st.playedTotal, 15610); eq(st.playedLevel, 3453)
  assert(mock.playedRequested, "played time requested")
  assert(not mock.playedDisplayed, "default chat print suppressed")
  local kinds = {}
  for _, e in ipairs(NS.session.events) do kinds[e.k] = (kinds[e.k] or 0) + 1 end
  eq(kinds.level_up, 1); eq(kinds.death, 1)
end)

test("item links are parsed and items recorded with info and tooltip once each", function()
  loadAddon(); player(); login()
  local id, suffix, str = NS.ids.itemLink("|cff1eff00|Hitem:3184:0:0:0:0:0:0:0:60|h[Venomstrike]|h|r")
  eq(id, 3184); eq(suffix, 0); eq(str, "item:3184:0:0:0:0:0:0:0:60")
  eq(NS.ids.itemLink("item:2589:0:0:0:0:0:-12:0"), 2589)
  eq(select(2, NS.ids.itemLink("item:2589:0:0:0:0:0:-12:0")), -12)
  eq(NS.ids.itemLink("nope"), nil)
  local rec = NS.items.see("|cff0070dd|Hitem:3184:0:0:0:0:0:0:0:60|h[Venomstrike]|h|r")
  assert(rec, "recorded"); eq(rec.name, "Venomstrike"); eq(rec.q, 3); eq(rec.il, 20); eq(rec.rl, 15); eq(rec.cls, "Weapon"); eq(rec.sub, "Dagger")
  eq(rec.eq, "INVTYPE_WEAPON"); eq(rec.ic, 135641); eq(rec.sp, 1800); eq(rec.bt, 2); eq(#rec.tip, 10); eq(rec.tip[8], "Chance on hit: Poisons target for 7 Nature damage every 3 sec for 15 sec.")
  eq(NS.items.see("|cff0070dd|Hitem:3184:0:0:0:0:0:0:0:60|h[Venomstrike]|h|r"), nil, "once per session")
  -- not cached yet: recorded when the client delivers it
  eq(NS.items.see("|cffffffff|Hitem:9999:0:0:0:0:0:0:0:60|h[Mystery]|h|r"), nil)
  mock.items[9999] = { name = "Mystery", quality = 2, itemLevel = 9, reqLevel = 4, class = "Armor", subclass = "Cloth", maxStack = 1, equipLoc = "INVTYPE_CHEST", texture = 1, sellPrice = 2, classID = 4, subclassID = 1, bindType = 1, expansionID = 0, setID = 0 }
  mock.fire("GET_ITEM_INFO_RECEIVED", 9999, true)
  eq(NS.session.world.items["9999"].name, "Mystery")
  mock.items[9999] = nil
end)

test("bags and equipment feed item discovery after entering the world", function()
  loadAddon(); player()
  mock.bags = { [0] = { "|cffffffff|Hitem:2589:0:0:0:0:0:0:0:60|h[Linen Cloth]|h|r" } }
  mock.equipment = { [16] = "|cffffffff|Hitem:2092:0:0:0:0:0:0:0:60|h[Worn Dagger]|h|r" }
  login()
  assert(NS.session.world.items["2589"] and NS.session.world.items["2092"], "both recorded")
  mock.bags = {}; mock.equipment = {}
end)

test("loot windows count once per spawn with items, quantities and quest flags", function()
  loadAddon(); player(); login()
  local corpse = "Creature-0-5162-1-56-2955-00003DC5F0"
  mock.units.target = { guid = corpse, name = "Plainstrider", level = 2, dead = true, health = 0, healthMax = 42 }
  mock.loot.slots = {
    { link = "|cffffffff|Hitem:2589:0:0:0:0:0:0:0:60|h[Linen Cloth]|h|r", qty = 3, sources = { corpse, 3 } },
    { link = "|cffffffff|Hitem:4540:0:0:0:0:0:0:0:60|h[Tough Hunk of Bread]|h|r", qty = 1, quest = true, sources = { corpse, 1 } },
    { type = 2, sources = { corpse, 1 } },
  }
  mock.fire("LOOT_OPENED")
  mock.fire("LOOT_OPENED") -- reopened: same spawn, counts once
  local l = NS.session.world.loot["c:2955"]
  assert(l, "loot source"); eq(l.k, "c"); eq(l.id, 2955); eq(l.w, 1)
  eq(l.items["2589"].n, 1); eq(l.items["2589"].min, 3); eq(l.items["2589"].max, 3); eq(l.items["4540"].q, true); eq(l.items["4540"].n, 1)
  assert(NS.session.world.items["2589"], "item discovered from loot")
  -- another spawn with nothing in it still counts as a window
  mock.units.target.guid = "Creature-0-5162-1-56-2955-00003DC5F1"
  mock.loot.slots = {}
  mock.fire("LOOT_OPENED")
  eq(l.w, 2); eq(l.items["2589"].n, 1)
  -- a chest
  mock.units.target = nil
  mock.loot.slots = { { link = "|cff1eff00|Hitem:2589:0:0:0:0:0:0:0:60|h[Linen Cloth]|h|r", qty = 1, sources = { "GameObject-0-5162-1-56-2912-000040695B", 1 } } }
  mock.fire("LOOT_OPENED")
  eq(NS.session.world.loot["o:2912"].w, 1); eq(NS.session.world.loot["o:2912"].items["2589"].n, 1)
  -- fishing in Mulgore
  mock.loot.fishing = true
  mock.loot.slots = { { link = "|cffffffff|Hitem:4540:0:0:0:0:0:0:0:60|h[Tough Hunk of Bread]|h|r", qty = 1 } }
  mock.fire("LOOT_OPENED")
  eq(NS.session.world.loot["f:1412"].w, 1); eq(NS.session.world.loot["f:1412"].k, "f")
  mock.loot = { slots = {}, fishing = false }
end)

test("own loot of uncommon quality or better becomes a journal event", function()
  loadAddon(); player(); login()
  local before = #NS.session.events
  mock.fire("CHAT_MSG_LOOT", "You receive loot: |cffffffff|Hitem:2589:0:0:0:0:0:0:0:60|h[Linen Cloth]|h|rx3.", "", "", "", "Eigan")
  eq(#NS.session.events, before, "common loot is not a journal event")
  mock.fire("CHAT_MSG_LOOT", "You receive loot: |cff0070dd|Hitem:3184:0:0:0:0:0:0:0:60|h[Venomstrike]|h|r.", "", "", "", "Eigan")
  local ev = NS.session.events[#NS.session.events]
  eq(ev.k, "loot"); eq(ev.d.item, 3184); eq(ev.d.n, 1); eq(ev.d.q, 3); eq(ev.m, 1412)
end)

test("a merchant's wares are recorded with prices, stock and extended costs", function()
  loadAddon(); player(); login()
  mock.units.npc = { guid = "Creature-0-5162-1-56-3077-00003DC5F2", name = "Harn Longcast", level = 20, reaction = 5, health = 1, healthMax = 1 }
  mock.merchant = { repair = true, items = {
    { link = "|cffffffff|Hitem:4540:0:0:0:0:0:0:0:60|h[Tough Hunk of Bread]|h|r", price = 25, stack = 5 },
    { link = "|cffffffff|Hitem:2092:0:0:0:0:0:0:0:60|h[Worn Dagger]|h|r", price = 30, stack = 1, avail = 2 },
    { link = "|cff0070dd|Hitem:3184:0:0:0:0:0:0:0:60|h[Venomstrike]|h|r", price = 0, stack = 1, extended = true, costs = { { value = 5, link = "|cffffffff|Hitem:2589:0:0:0:0:0:0:0:60|h[Linen Cloth]|h|r" }, { value = 100, name = "Honor" } } },
  } }
  mock.fire("MERCHANT_SHOW")
  local v = NS.session.world.vendors["3077"]
  assert(v, "vendor recorded"); eq(v.rep, true); eq(v.items["4540"].p, 25); eq(v.items["4540"].st, 5); eq(v.items["4540"].lim, nil)
  eq(v.items["2092"].lim, 2); eq(v.items["3184"].ec[1].i, 2589); eq(v.items["3184"].ec[1].n, 5); eq(v.items["3184"].ec[2].name, "Honor")
  assert(NS.session.world.creatures["3077"].roles.vendor, "vendor role from the merchant window")
  mock.merchant = { items = {}, repair = false }; mock.units.npc = nil
end)

test("the add-on never changes client settings", function()
  mock.cvars = { nameplateShowFriendlyNPCs = "0", nameplateShowOnlyNames = "0", nameplateMaxDistance = "20" }
  loadAddon(); player(); login(); mock.fire("PLAYER_LOGOUT")
  eq(mock.cvars.nameplateShowFriendlyNPCs, "0"); eq(mock.cvars.nameplateMaxDistance, "20")
  assert(not mock.setCVarCalled, "SetCVar must never be called")
end)

test("a failing handler is isolated and recorded", function()
  loadAddon(); player(); login()
  NS.on("PLAYER_TARGET_CHANGED", function() error("boom") end)
  local ran = false
  NS.on("PLAYER_TARGET_CHANGED", function() ran = true end)
  mock.units.target = nil
  mock.fire("PLAYER_TARGET_CHANGED")
  assert(ran, "later handler still ran")
  assert(WoWCompendiumDB.errors.PLAYER_TARGET_CHANGED, "error recorded")
end)

out(string.format("\n%d passed, %d failed", passed, failed))
os.exit(failed == 0 and 0 or 1)
