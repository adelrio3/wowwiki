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

-- Item tooltip from a link (verified on era: SetHyperlink works, docs/03).
function compat.itemTooltip(link)
  return compat.tooltipLines("SetHyperlink", link)
end

-- Build a Lua pattern from a Blizzard format string like "Discovered %s: %d experience gained".
function compat.patternFrom(fmt)
  if type(fmt) ~= "string" then return nil end
  local p = string.gsub(fmt, "([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1")
  p = string.gsub(p, "%%%%s", "(.-)")
  p = string.gsub(p, "%%%%d", "(%%d+)")
  return "^" .. p .. "$"
end

-- GetItemInfo as a table, or nil while the client has not cached the item
-- (GET_ITEM_INFO_RECEIVED follows). The texture is a FileDataID number on
-- every current client. VERIFY on era: expansionID and setID positions.
function compat.itemInfo(link)
  local fn = (C_Item and C_Item.GetItemInfo) or GetItemInfo
  if not fn then return nil end
  local name, _, quality, itemLevel, reqLevel, class, subclass, maxStack, equipLoc, texture, sellPrice, classID, subclassID, bindType, expansionID, setID, isReagent = fn(link)
  if not name then return nil end
  return {
    name = name, quality = quality, itemLevel = itemLevel, reqLevel = reqLevel, class = class, subclass = subclass,
    maxStack = maxStack, equipLoc = equipLoc, texture = texture, sellPrice = sellPrice, classID = classID,
    subclassID = subclassID, bindType = bindType, expansionID = expansionID, setID = setID, isReagent = isReagent,
  }
end

-- One loot slot: quantity, quest flag, quest ID. Era's GetLootSlotInfo returns
-- are shifted by one from retail's (N-0007): quantity 3, isQuestItem 8, questID 9
-- there; quantity 3, isQuestItem 7, questID 8 elsewhere.
function compat.lootSlot(i)
  if not GetLootSlotInfo then return nil end
  local r = { GetLootSlotInfo(i) }
  if WOW_PROJECT_ID == 2 then
    return r[3], r[8] and true or false, r[9]
  end
  return r[3], r[7] and true or false, r[8]
end

-- Loot slot kinds: 1 item, 2 money, 3 currency.
function compat.lootSlotIsItem(i)
  if not GetLootSlotType then return true end
  local kind = GetLootSlotType(i)
  return kind == nil or kind == 1 or kind == (Enum and Enum.LootSlotType and Enum.LootSlotType.Item)
end

-- GUIDs that produced slot i (retail area loot can mix sources), or nil.
function compat.lootSources(i)
  if not GetLootSourceInfo then return nil end
  local r = { GetLootSourceInfo(i) }
  local out = {}
  for j = 1, #r, 2 do if type(r[j]) == "string" then out[#out + 1] = r[j] end end
  return out
end

-- Merchant slot: price in copper, stack, limited stock (-1 unlimited), extended cost flag.
function compat.merchantItem(i)
  if not GetMerchantItemInfo then return nil end
  local name, texture, price, stack, avail, purchasable, usable, extended = GetMerchantItemInfo(i)
  return name, price, stack, avail, extended
end

function compat.containerSlots(bag)
  if C_Container and C_Container.GetContainerNumSlots then return C_Container.GetContainerNumSlots(bag) end
  if GetContainerNumSlots then return GetContainerNumSlots(bag) end
  return 0
end

function compat.containerItemLink(bag, slot)
  if C_Container and C_Container.GetContainerItemLink then return C_Container.GetContainerItemLink(bag, slot) end
  if GetContainerItemLink then return GetContainerItemLink(bag, slot) end
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

-- The open flight map: every node with its state (0 current, 1 reachable,
-- 2 unreachable) and the map it is drawn on. Nil when no flight map is open.
function compat.taxiMapNodes()
  if not (C_TaxiMap and C_TaxiMap.GetAllTaxiNodes) then return nil end
  local mapID
  if GetTaxiMapID then
    local ok, id = pcall(GetTaxiMapID)
    if ok then mapID = id end
  end
  if not mapID then mapID = compat.playerMapPosition() end
  if not mapID then return nil end
  local ok, nodes = pcall(C_TaxiMap.GetAllTaxiNodes, mapID)
  if not ok or type(nodes) ~= "table" then return nil end
  return nodes, mapID
end

