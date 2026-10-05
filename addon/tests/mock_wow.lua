-- Minimal mock of the WoW client API surface the add-on touches at load and
-- in tests. Deliberately small: anything not here is nil, which is also how a
-- flavor without that capability looks to the add-on.
local M = {}

M.printed = {}
M.timers = {}
M.serverTime = 1790998608
M.units = {}          -- token -> unit table
M.tooltips = {}       -- token -> array of lines
M.mapID = 1412
M.mapPos = { x = 0.5, y = 0.8 }
M.worldPos = { inst = 1, x = -351.8, y = -2357 }
M.areaIDs = { 222 }
M.areaNames = { [222] = "Bloodhoof Village" }
M.zone, M.subzone = "Mulgore", "Bloodhoof Village"
M.instance = { "Kalimdor", "none", 0, "", 0, 0, false, 1, 0 }
M.registered = {}
M.unknownEvents = { LEARNED_SPELL_IN_TAB = true, HARDCORE_DEATH = true }
-- Items the client has cached: itemID -> GetItemInfo-style table; others are "not yet cached".
M.items = {
  [2589] = { name = "Linen Cloth", quality = 1, itemLevel = 5, reqLevel = 0, class = "Trade Goods", subclass = "Cloth", maxStack = 20, equipLoc = "", texture = 132889, sellPrice = 13, classID = 7, subclassID = 5, bindType = 0, expansionID = 0, setID = 0 },
  [2092] = { name = "Worn Dagger", quality = 1, itemLevel = 2, reqLevel = 1, class = "Weapon", subclass = "Dagger", maxStack = 1, equipLoc = "INVTYPE_WEAPON", texture = 135641, sellPrice = 6, classID = 2, subclassID = 15, bindType = 0, expansionID = 0, setID = 0 },
  [4540] = { name = "Tough Hunk of Bread", quality = 1, itemLevel = 5, reqLevel = 1, class = "Consumable", subclass = "Food & Drink", maxStack = 20, equipLoc = "", texture = 133964, sellPrice = 1, classID = 0, subclassID = 5, bindType = 0, expansionID = 0, setID = 0 },
  [3184] = { name = "Venomstrike", quality = 3, itemLevel = 20, reqLevel = 15, class = "Weapon", subclass = "Dagger", maxStack = 1, equipLoc = "INVTYPE_WEAPON", texture = 135641, sellPrice = 1800, classID = 2, subclassID = 15, bindType = 2, expansionID = 0, setID = 0 },
}
M.itemTooltips = { [3184] = { "Venomstrike", "Binds when picked up", "One-Hand", "Dagger", "15 - 29 Damage", "Speed 1.60", "(13.8 damage per second)", "Chance on hit: Poisons target for 7 Nature damage every 3 sec for 15 sec.", "Requires Level 15", "Sell Price: 18 Silver" } }
M.loot = { slots = {}, fishing = false }   -- slots: { link=, qty=, quest=, type=, sources={guid, qty, ...} }
M.merchant = { items = {}, repair = false } -- items: { link=, price=, stack=, avail=, extended=, costs={ {value=, link=, name=} } }
M.bags = {}        -- bag -> array of links
M.equipment = {}   -- slot -> link

function M.install()
  -- The real client does not expose math.randomseed (N-0014).
  math.randomseed = nil
  _G.WOW_PROJECT_ID = 2
  _G.LEVEL = "Level"
  _G.PVP = "PvP"
  _G.ERR_ZONE_EXPLORED_XP = "Discovered %s: %d experience gained"
  _G.ERR_ZONE_EXPLORED = "Discovered %s"
  _G.LOOT_ITEM_SELF = "You receive loot: %s."
  _G.LOOT_ITEM_SELF_MULTIPLE = "You receive loot: %sx%d."
  local function itemFromLink(link)
    local id = tonumber(string.match(tostring(link), "item:(%d+)"))
    return id and M.items[id], id
  end
  M.itemFromLink = itemFromLink
  _G.GetItemInfo = function(link)
    local it = itemFromLink(link)
    if not it then return nil end
    return it.name, link, it.quality, it.itemLevel, it.reqLevel, it.class, it.subclass, it.maxStack, it.equipLoc, it.texture, it.sellPrice, it.classID, it.subclassID, it.bindType, it.expansionID, it.setID, false
  end
  _G.GetNumLootItems = function() return #M.loot.slots end
  _G.GetLootSlotLink = function(i) return M.loot.slots[i] and M.loot.slots[i].link end
  _G.GetLootSlotType = function(i) return M.loot.slots[i] and (M.loot.slots[i].type or 1) end
  -- era order (N-0007): texture, name, quantity, currencyID, nil, quality, locked, isQuestItem, questID, isActive
  _G.GetLootSlotInfo = function(i) local s = M.loot.slots[i] return 1, "x", s.qty or 1, nil, nil, 1, false, s.quest or false, nil, false end
  _G.GetLootSourceInfo = function(i) local s = M.loot.slots[i] if s and s.sources then return unpack(s.sources) end end
  _G.IsFishingLoot = function() return M.loot.fishing end
  _G.UnitIsDead = function(t) local u = M.units[t] return u and u.dead or false end
  _G.GetMerchantNumItems = function() return #M.merchant.items end
  _G.GetMerchantItemLink = function(i) return M.merchant.items[i] and M.merchant.items[i].link end
  _G.GetMerchantItemInfo = function(i) local m = M.merchant.items[i] return "x", 1, m.price, m.stack or 1, m.avail or -1, true, true, m.extended or false end
  _G.GetMerchantItemCostInfo = function(i) local m = M.merchant.items[i] return m.costs and #m.costs or 0 end
  _G.GetMerchantItemCostItem = function(i, j) local c = M.merchant.items[i].costs[j] return 1, c.value, c.link, c.name end
  _G.CanMerchantRepair = function() return M.merchant.repair end
  _G.C_Container = { GetContainerNumSlots = function(bag) return M.bags[bag] and #M.bags[bag] or 0 end, GetContainerItemLink = function(bag, slot) return M.bags[bag] and M.bags[bag][slot] end }
  _G.GetInventoryItemLink = function(_, slot) return M.equipment[slot] end
  _G.UIParent = {}
  _G.print = function(...)
    local parts = {}
    for i = 1, select("#", ...) do parts[#parts + 1] = tostring(select(i, ...)) end
    M.printed[#M.printed + 1] = table.concat(parts, " ")
  end
  _G.GetServerTime = function() return M.serverTime end
  _G.GetTime = function() return M.serverTime * 1.0 end
  _G.C_Timer = { After = function(delay, fn) M.timers[#M.timers + 1] = { delay = delay, fn = fn } end }
  _G.C_AddOns = { GetAddOnMetadata = function(_, key)
    if key == "Version" then return "0.1.0-test" end
    if key == "X-Toc" then return "Vanilla" end
  end }
  _G.GetBuildInfo = function() return "1.15.9", "70003", "Sep 23 2026", 11509, "", "Release", 11509 end
  _G.GetLocale = function() return "enUS" end
  _G.GetRealmName = function() return "Mankrik" end
  _G.GetNormalizedRealmName = function() return "Mankrik" end
  _G.GetRealmID = function() return 5149 end
  _G.GetCurrentRegion = function() return 1 end
  _G.GetCurrentRegionName = function() return "US" end
  _G.GetAutoCompleteRealms = function() return { "Mankrik", "Westfall" } end
  _G.C_GameRules = { IsHardcoreActive = function() return false end }
  _G.C_Seasons = { HasActiveSeason = function() return false end, GetActiveSeason = function() return nil end }
  _G.GetZoneText = function() return M.zone end
  _G.GetSubZoneText = function() return M.subzone end
  _G.GetInstanceInfo = function() return unpack(M.instance) end
  _G.IsIndoors = function() return false end
  _G.GetMoney = function() return 67 end
  _G.GetBindLocation = function() return "Bloodhoof Village" end
  _G.RequestTimePlayed = function() M.playedRequested = true end
  M.cvars = { nameplateShowFriendlyNPCs = "0", nameplateShowOnlyNames = "0", nameplateMaxDistance = "20" }
  _G.GetCVar = function(name) return M.cvars[name] end
  _G.SetCVar = function(name, value) M.setCVarCalled = true; M.cvars[name] = tostring(value) end
  _G.ChatFrame_DisplayTimePlayed = function() M.playedDisplayed = true end

  _G.C_Map = {
    GetBestMapForUnit = function() return M.mapID end,
    GetPlayerMapPosition = function() return { GetXY = function() return M.mapPos.x, M.mapPos.y end } end,
    GetMapInfo = function(id) return { mapID = id, name = "Mulgore", mapType = 3, parentMapID = 1414 } end,
    GetAreaInfo = function(id) return M.areaNames[id] end,
    GetMapChildrenInfo = function() return { { mapID = 1414, name = "Kalimdor", mapType = 2 }, { mapID = 1412, name = "Mulgore", mapType = 3 } } end,
    GetMapArtLayers = function(id) if id == 946 then error("no art") end return { { layerWidth = 1002, layerHeight = 668, tileWidth = 256, tileHeight = 256 } } end,
    GetMapArtLayerTextures = function(id) if id == 946 then error("no art") end local t = {} for i = 1, 12 do t[i] = id * 100 + i end return t end,
    GetMapArtID = function(id) return id + 5000 end,
  }
  _G.UnitPosition = function() return M.worldPos.y, M.worldPos.x, 0, M.worldPos.inst end
  _G.C_MapExplorationInfo = {
    GetExploredAreaIDsAtPosition = function() return M.areaIDs end,
    GetExploredMapTextures = function(id) if id ~= 1412 then return {} end return { { textureWidth = 256, textureHeight = 256, offsetX = 300, offsetY = 200, fileDataIDs = { 272173 } } } end,
  }
  _G.C_TaxiMap = {
    GetTaxiNodesForMap = function()
      return { { nodeID = 22, name = "Thunder Bluff, Mulgore", position = { GetXY = function() return 0.39, 0.27 end }, faction = 1, isUndiscovered = false } }
    end,
    GetAllTaxiNodes = function()
      return {
        { nodeID = 22, name = "Thunder Bluff, Mulgore", state = 0, position = { GetXY = function() return 0.39, 0.27 end } },
        { nodeID = 25, name = "The Crossroads, The Barrens", state = 1, position = { GetXY = function() return 0.52, 0.30 end } },
        { nodeID = 23, name = "Orgrimmar, Durotar", state = 2, position = { GetXY = function() return 0.61, 0.21 end } },
      }
    end,
  }
  _G.GetTaxiMapID = function() return 1414 end

  local function unit(token) return M.units[token] end
  _G.UnitExists = function(t) return unit(t) ~= nil end
  _G.UnitGUID = function(t) local u = unit(t) return u and u.guid end
  _G.UnitName = function(t) local u = unit(t) return u and u.name end
  _G.UnitLevel = function(t) local u = unit(t) return u and u.level end
  _G.UnitClass = function(t) local u = unit(t) return u and u.className, u and u.classFile, u and u.classId end
  _G.UnitRace = function(t) local u = unit(t) return u and u.race, u and u.raceFile, u and u.raceId end
  _G.UnitFactionGroup = function(t) local u = unit(t) return u and u.factionGroup end
  _G.UnitSex = function(t) local u = unit(t) return u and u.sex end
  _G.UnitClassification = function(t) local u = unit(t) return u and u.classification end
  _G.UnitCreatureType = function(t) local u = unit(t) return u and u.creatureType end
  _G.UnitCreatureFamily = function(t) local u = unit(t) return u and u.creatureFamily end
  _G.UnitReaction = function(_, t) local u = unit(t) return u and u.reaction end
  _G.UnitIsPVP = function(t) local u = unit(t) return u and u.pvp end
  _G.UnitCanAttack = function(_, t) local u = unit(t) return u and u.attackable end
  _G.UnitIsCivilian = function(t) local u = unit(t) return u and u.civilian end
  _G.UnitPlayerControlled = function(t) local u = unit(t) return u and u.playerControlled or false end
  _G.UnitPowerType = function(t) local u = unit(t) return u and u.powerType end
  _G.UnitHealth = function(t) local u = unit(t) return u and u.health end
  _G.UnitHealthMax = function(t) local u = unit(t) return u and u.healthMax end
  _G.UnitPowerMax = function(t) local u = unit(t) return u and u.powerMax end
  _G.UnitXP = function() return 2689 end
  _G.UnitXPMax = function() return 2800 end
  _G.UnitIsUnit = function(a, b) local ua, ub = unit(a), unit(b) return ua and ub and ua.guid == ub.guid end

  _G.CreateFrame = function(kind, name)
    local f = { kind = kind, name = name, events = {} }
    function f:RegisterEvent(ev)
      if M.unknownEvents[ev] then error("Attempt to register unknown event \"" .. ev .. "\"") end
      self.events[ev] = true
      M.registered[ev] = true
    end
    function f:SetScript(_, fn) self.onEvent = fn end
    -- tooltip surface
    function f:SetOwner() end
    function f:ClearLines() self.lines = {} end
    function f:Hide() end
    function f:NumLines() return self.lines and #self.lines or 0 end
    function f:GetUnit() return self.unitName, self.unitToken end
    function f:SetHyperlink(link)
      local it, id = itemFromLink(link)
      if not it then error("unknown item") end
      self.lines = M.itemTooltips[id] or { it.name }
      for i, line in ipairs(self.lines) do
        _G[name .. "TextLeft" .. i] = { GetText = function() return line end }
      end
    end
    function f:SetUnit(token)
      local u = unit(token)
      if not u then error("bad unit") end
      self.lines = M.tooltips[token] or { u.name, "Level " .. tostring(u.level) }
      self.unitName, self.unitToken = u.name, token
      for i, line in ipairs(self.lines) do
        _G[name .. "TextLeft" .. i] = { GetText = function() return line end }
      end
    end
    if kind == "Frame" then M.frame = f end
    return f
  end
end

function M.fire(event, ...)
  assert(M.frame and M.frame.onEvent, "no event frame")
  M.frame.onEvent(M.frame, event, ...)
end

function M.runTimers()
  local list = M.timers
  M.timers = {}
  for _, t in ipairs(list) do t.fn() end
end

return M
