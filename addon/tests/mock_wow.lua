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

function M.install()
  -- The real client does not expose math.randomseed (N-0014).
  math.randomseed = nil
  _G.WOW_PROJECT_ID = 2
  _G.LEVEL = "Level"
  _G.PVP = "PvP"
  _G.ERR_ZONE_EXPLORED_XP = "Discovered %s: %d experience gained"
  _G.ERR_ZONE_EXPLORED = "Discovered %s"
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
  _G.ChatFrame_DisplayTimePlayed = function() M.playedDisplayed = true end

  _G.C_Map = {
    GetBestMapForUnit = function() return M.mapID end,
    GetPlayerMapPosition = function() return { GetXY = function() return M.mapPos.x, M.mapPos.y end } end,
    GetMapInfo = function(id) return { mapID = id, name = "Mulgore", mapType = 3, parentMapID = 1414 } end,
    GetAreaInfo = function(id) return M.areaNames[id] end,
  }
  _G.UnitPosition = function() return M.worldPos.y, M.worldPos.x, 0, M.worldPos.inst end
  _G.C_MapExplorationInfo = { GetExploredAreaIDsAtPosition = function() return M.areaIDs end }
  _G.C_TaxiMap = { GetTaxiNodesForMap = function()
    return { { nodeID = 22, name = "Thunder Bluff, Mulgore", position = { GetXY = function() return 0.39, 0.27 end }, faction = 1, isUndiscovered = false } }
  end }

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
  _G.UnitIsCivilian = function(t) local u = unit(t) return u and u.civilian end
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
