-- Zones, areas, maps, instances, flight node catalog, and the Journal's
-- movement, level, played time, death, and discovery events (docs/03).
local _, NS = ...
local store, compat, throttle = NS.store, NS.compat, NS.throttle

local lastMap, lastZoneKey, lastAreaId

-- Build a Lua pattern from a Blizzard format string like "Discovered %s: %d experience gained".
local function patternFrom(fmt)
  if type(fmt) ~= "string" then return nil end
  local p = string.gsub(fmt, "([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1")
  p = string.gsub(p, "%%%%s", "(.-)")
  p = string.gsub(p, "%%%%d", "(%%d+)")
  return "^" .. p .. "$"
end

local DISCOVER_XP = patternFrom(ERR_ZONE_EXPLORED_XP)
local DISCOVER = patternFrom(ERR_ZONE_EXPLORED)

local function recordMap(mapID)
  local rec = store.map(mapID)
  if not rec then return end
  local info = compat.mapInfo(mapID)
  if info then
    rec.name = info.name
    rec.type = info.mapType
    rec.parent = info.parentMapID
  end
  return rec
end

local function recordInstance()
  local name, itype, diff, diffName, maxPlayers, _, _, instanceID = compat.instanceInfo()
  if not instanceID or itype == "none" then return nil end
  local rec = store.instance(instanceID)
  if not rec then return end
  rec.name = name
  rec.type = itype
  rec.diff = diff
  rec.diffName = diffName
  rec.max = maxPlayers
  return rec, instanceID
end

local function recordTaxiCatalog(mapID)
  if not throttle.allow("taxi:" .. tostring(mapID), 300) then return end
  local nodes = compat.taxiNodesForMap(mapID)
  if not nodes then return end
  for _, node in ipairs(nodes) do
    if node.nodeID then
      local rec = store.taxiNode(node.nodeID)
      if rec then
        rec.name = node.name
        rec.m = mapID
        if node.position and node.position.GetXY then
          rec.x, rec.y = node.position:GetXY()
        elseif node.position then
          rec.x, rec.y = node.position.x, node.position.y
        end
        rec.faction = node.faction
        rec.undiscovered = node.isUndiscovered and true or false
      end
    end
  end
end

-- Where am I: maps, areas, zone texts, instance, explored set, zone_enter events.
local function locate(reason)
  if not NS.session then return end
  local map, x, y = compat.playerMapPosition()
  local zone, sub = GetZoneText() or "", GetSubZoneText() or ""
  local pos = store.pos("player")

  if map and map ~= lastMap then
    recordMap(map)
    local inst, instanceID = recordInstance()
    local d = { map = map, zone = zone }
    if instanceID then d.instance = instanceID end
    store.event("zone_enter", d, true)
    if inst then store.event("instance_enter", { instance = instanceID, type = inst.type, diff = inst.diff }, true) end
    recordTaxiCatalog(map)
    lastMap = map
  end

  -- Area ids at this position (N-0010).
  local areaIDs = compat.exploredAreaIdsHere(map, x, y)
  local areaID = areaIDs and areaIDs[1]
  if areaID then
    local rec = store.area(areaID)
    if rec then
      rec.name = rec.name or compat.areaName(areaID)
      rec.m = map
      rec.zone = zone
      if sub ~= "" then rec.sub = sub end
      if areaID ~= lastAreaId then store.addPos(rec, pos) end
    end
    store.explored(areaID)
    lastAreaId = areaID
  end

  -- Zone/subzone text as its own record (boundary samples).
  if zone ~= "" then
    local key = zone .. "/" .. sub
    local rec = store.zoneText(zone, sub)
    if rec then
      rec.m = map
      if IsIndoors and IsIndoors() then rec.indoors = true end
      if key ~= lastZoneKey then store.addPos(rec, pos) end
    end
    lastZoneKey = key
  end
end

NS.on("PLAYER_LOGIN", function()
  lastMap, lastZoneKey, lastAreaId = nil, nil, nil
  -- Give the map a moment to settle after login.
  if C_Timer and C_Timer.After then
    C_Timer.After(2, function() locate("login") end)
  else
    locate("login")
  end
end)
NS.on("ZONE_CHANGED_NEW_AREA", function() locate("new_area") end)
NS.on("ZONE_CHANGED", function() locate("zone") end)
NS.on("ZONE_CHANGED_INDOORS", function() locate("indoors") end)

-- Discovery messages (localized via Blizzard's own format strings).
local function discovery(text)
  if type(text) ~= "string" then return end
  local name, xp
  if DISCOVER_XP then name, xp = string.match(text, DISCOVER_XP) end
  if not name and DISCOVER then name = string.match(text, DISCOVER) end
  if not name then return end
  local map = compat.playerMapPosition()
  local areaIDs = compat.exploredAreaIdsHere(map, 0, 0)
  local d = { name = name }
  if xp then d.xp = tonumber(xp) end
  if areaIDs and areaIDs[1] then d.area = areaIDs[1] end
  store.event("area_discovered", d, true)
  locate("discovery")
end
NS.on("UI_INFO_MESSAGE", function(_, text) discovery(text) end)
NS.on("CHAT_MSG_SYSTEM", function(text) discovery(text) end)

-- Level, played time, money, death: Journal.
NS.on("PLAYER_LEVEL_UP", function(level)
  local st = store.state()
  if st then st.level = level end
  store.event("level_up", { level = level }, true)
end)

NS.on("PLAYER_DEAD", function()
  store.event("death", { level = UnitLevel("player"), hardcore = compat.isHardcore() }, true)
end)

-- Played time without the default chat spam: temporarily silence the
-- default display function while our request is outstanding.
local awaitingPlayed = false
NS.on("TIME_PLAYED_MSG", function(total, level)
  local st = store.state()
  if st then
    st.playedTotal = total
    st.playedLevel = level
  end
  if awaitingPlayed and NS._origDisplayTimePlayed then
    ChatFrame_DisplayTimePlayed = NS._origDisplayTimePlayed
    NS._origDisplayTimePlayed = nil
    awaitingPlayed = false
  end
end)

local function requestPlayed()
  if not RequestTimePlayed then return end
  if ChatFrame_DisplayTimePlayed and not NS._origDisplayTimePlayed then
    NS._origDisplayTimePlayed = ChatFrame_DisplayTimePlayed
    ChatFrame_DisplayTimePlayed = function() end
    awaitingPlayed = true
    if C_Timer and C_Timer.After then
      C_Timer.After(10, function()
        if awaitingPlayed and NS._origDisplayTimePlayed then
          ChatFrame_DisplayTimePlayed = NS._origDisplayTimePlayed
          NS._origDisplayTimePlayed = nil
          awaitingPlayed = false
        end
      end)
    end
  end
  RequestTimePlayed()
end

local function snapshotState()
  local st = store.state()
  if not st then return end
  st.level = UnitLevel("player")
  if UnitXP then st.xp = UnitXP("player"); st.xpMax = UnitXPMax("player") end
  if GetMoney then st.money = GetMoney() end
  if GetBindLocation then st.bind = GetBindLocation() end
end

NS.on("PLAYER_LOGIN", function()
  snapshotState()
  if C_Timer and C_Timer.After then C_Timer.After(5, requestPlayed) else requestPlayed() end
end)
NS.on("PLAYER_LOGOUT", function() snapshotState() end)
