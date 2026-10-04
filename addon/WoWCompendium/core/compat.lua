-- Per-flavor shims. One function per capability; each returns nil when the
-- capability is missing so modules can degrade instead of erroring.
-- Facts verified on Classic Era 1.15.9 are noted; see docs/03 and docs/11.
local _, NS = ...
local compat = {}
NS.compat = compat

-- Hidden tooltip (N-0001): C_TooltipInfo is absent on era, so lines are read
-- from a private GameTooltip frame.
local tip
local function getTip()
  if not tip then
    tip = CreateFrame("GameTooltip", "WoWCompendiumTip", UIParent, "GameTooltipTemplate")
  end
  return tip
end

-- Returns an array of left-text lines, or nil on failure.
function compat.tooltipLines(method, ...)
  local t = getTip()
  if type(t[method]) ~= "function" then return nil end
  t:SetOwner(UIParent, "ANCHOR_NONE")
  t:ClearLines()
  local ok = pcall(t[method], t, ...)
  if not ok then t:Hide() return nil end
  local lines = {}
  local n = t:NumLines() or 0
  for i = 1, n do
    local fs = _G["WoWCompendiumTipTextLeft" .. i]
    lines[i] = fs and fs:GetText() or ""
  end
  t:Hide()
  return lines
end

function compat.unitTooltip(unit)
  return compat.tooltipLines("SetUnit", unit)
end

-- Map position of the player: uiMapID, x, y (fractions) or nil.
function compat.playerMapPosition()
  if not (C_Map and C_Map.GetBestMapForUnit) then return nil end
  local map = C_Map.GetBestMapForUnit("player")
  if not map then return nil end
  local pos = C_Map.GetPlayerMapPosition(map, "player")
  if not pos then return map end
  local x, y = pos:GetXY()
  return map, x, y
end

-- World position of the player: instanceID, worldX, worldY (N-0009).
function compat.playerWorldPosition()
  if not UnitPosition then return nil end
  local py, px, _, inst = UnitPosition("player")
  if not px then return nil end
  return inst, px, py
end

function compat.mapInfo(mapID)
  if C_Map and C_Map.GetMapInfo and mapID then
    return C_Map.GetMapInfo(mapID)
  end
end

-- Explored area ids at the player's position (N-0010).
function compat.exploredAreaIdsHere(mapID, x, y)
  if not (C_MapExplorationInfo and C_MapExplorationInfo.GetExploredAreaIDsAtPosition and mapID and x) then return nil end
  local pos = C_Map.GetPlayerMapPosition(mapID, "player")
  if not pos then return nil end
  local ok, ids = pcall(C_MapExplorationInfo.GetExploredAreaIDsAtPosition, mapID, pos)
  if ok and type(ids) == "table" then return ids end
  return nil
end

function compat.areaName(areaID)
  if C_Map and C_Map.GetAreaInfo and areaID then
    local ok, name = pcall(C_Map.GetAreaInfo, areaID)
    if ok then return name end
  end
end

-- Taxi node catalog for the current continent (N-0008).
function compat.taxiNodesForMap(mapID)
  if C_TaxiMap and C_TaxiMap.GetTaxiNodesForMap and mapID then
    local ok, nodes = pcall(C_TaxiMap.GetTaxiNodesForMap, mapID)
    if ok and type(nodes) == "table" then return nodes end
  end
end

function compat.instanceInfo()
  if GetInstanceInfo then
    return GetInstanceInfo()
  end
end

function compat.isHardcore()
  if C_GameRules and C_GameRules.IsHardcoreActive then
    local ok, v = pcall(C_GameRules.IsHardcoreActive)
    if ok then return v and true or false end
  end
  return false
end

function compat.activeSeason()
  if C_Seasons and C_Seasons.HasActiveSeason and C_Seasons.GetActiveSeason then
    local ok, has = pcall(C_Seasons.HasActiveSeason)
    if ok and has then
      local ok2, id = pcall(C_Seasons.GetActiveSeason)
      if ok2 then return id end
    end
  end
  return nil
end

function compat.connectedRealms()
  if GetAutoCompleteRealms then
    local ok, list = pcall(GetAutoCompleteRealms)
    if ok and type(list) == "table" then return list end
  end
end

-- Interaction type enum (Enum.PlayerInteractionType). Verified on era:
-- 3 gossip, 5 merchant, 7 trainer (docs/03). The rest follow Blizzard's enum:
-- 4 QuestGiver, 6 TaxiNode, 8 Banker, 10 GuildBanker, 11 Registrar,
-- 13 PetitionVendor, 14 GuildTabardVendor, 17 MailInfo, 18 SpiritHealer,
-- 20 Binder (innkeeper), 21 Auctioneer, 22 StableMaster, 23 BattleMaster.
compat.interactionRoles = {
  [3] = "gossip",
  [4] = "quest",
  [5] = "vendor",
  [6] = "taxi",
  [7] = "trainer",
  [8] = "bank",
  [10] = "guild_bank",
  [11] = "guild_registrar",
  [13] = "petition_vendor",
  [14] = "tabard_vendor",
  [17] = "mailbox",
  [18] = "spirit_healer",
  [20] = "innkeeper",
  [21] = "auctioneer",
  [22] = "stable_master",
  [23] = "battlemaster",
}

-- Map art (docs/03 "Map art catalog", D-0041). All pcall'd: the map API
-- throws on maps without art. Returns { w, h, tw, th, t = {fileDataID,...} }
-- for the base layer, or nil.
function compat.mapArt(mapID)
  if not (C_Map and C_Map.GetMapArtLayers and C_Map.GetMapArtLayerTextures and mapID) then return nil end
  local ok, layers = pcall(C_Map.GetMapArtLayers, mapID)
  if not ok or type(layers) ~= "table" or not layers[1] then return nil end
  local l = layers[1]
  local ok2, tiles = pcall(C_Map.GetMapArtLayerTextures, mapID, 1)
  if not ok2 or type(tiles) ~= "table" or #tiles == 0 then return nil end
  local art = { w = l.layerWidth, h = l.layerHeight, tw = l.tileWidth, th = l.tileHeight, t = {} }
  for i, id in ipairs(tiles) do art.t[i] = id end
  if C_Map.GetMapArtID then
    local ok3, aid = pcall(C_Map.GetMapArtID, mapID)
    if ok3 then art.aid = aid end
  end
  return art
end

-- Explored-area overlay pictures the client would draw for this character on
-- this map: { { w, h, x, y, t = {fileDataID,...} }, ... } or nil.
function compat.exploredTextures(mapID)
  if not (C_MapExplorationInfo and C_MapExplorationInfo.GetExploredMapTextures and mapID) then return nil end
  local ok, list = pcall(C_MapExplorationInfo.GetExploredMapTextures, mapID)
  if not ok or type(list) ~= "table" then return nil end
  local out = {}
  for _, o in ipairs(list) do
    if type(o) == "table" and o.fileDataIDs then
      local ov = { w = o.textureWidth, h = o.textureHeight, x = o.offsetX, y = o.offsetY, t = {} }
      for i, id in ipairs(o.fileDataIDs) do ov.t[i] = id end
      out[#out + 1] = ov
    end
  end
  return out
end

-- Every map the client knows, as { mapID, ... }. 946 is the cosmic root.
function compat.allMapIDs()
  if not (C_Map and C_Map.GetMapChildrenInfo) then return nil end
  local ok, children = pcall(C_Map.GetMapChildrenInfo, 946, nil, true)
  if not ok or type(children) ~= "table" then return nil end
  local ids = { 946 }
  for _, c in ipairs(children) do if c.mapID then ids[#ids + 1] = c.mapID end end
  return ids
end

