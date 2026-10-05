-- Items: every item link the client shows the player, with the client's own
-- item information and tooltip (docs/03 "Items"). Loot and vendor windows
-- feed links in through NS.items.see; so do the player's bags and equipment.
local _, NS = ...
local store, ids, compat, throttle = NS.store, NS.ids, NS.compat, NS.throttle

local items = {}
NS.items = items

-- Per-session memory, reset on PLAYER_LOGIN.
local seen = {}     -- itemID -> true once the info is recorded
local tipDone = {}  -- itemID -> true once the tooltip is recorded
local pending = {}  -- itemID -> link, waiting for the client to cache the item

NS.on("PLAYER_LOGIN", function()
  seen = {}
  tipDone = {}
  pending = {}
end)

local function record(link, id)
  local info = compat.itemInfo(link)
  if not info then
    pending[id] = link
    return nil
  end
  local rec = store.item(id)
  if not rec then return nil end
  rec.name = info.name
  rec.q = info.quality
  rec.il = info.itemLevel
  rec.rl = info.reqLevel
  rec.cls = info.class
  rec.sub = info.subclass
  rec.cid = info.classID
  rec.sid = info.subclassID
  rec.st = info.maxStack
  if info.equipLoc and info.equipLoc ~= "" then rec.eq = info.equipLoc end
  if type(info.texture) == "number" then rec.ic = info.texture end
  rec.sp = info.sellPrice
  rec.bt = info.bindType
  rec.xp = info.expansionID
  if info.setID and info.setID ~= 0 then rec.set = info.setID end
  if info.isReagent then rec.rg = true end
  if not tipDone[id] then
    tipDone[id] = true
    local lines = compat.itemTooltip(link)
    if lines then
      while #lines > 0 and lines[#lines] == "" do lines[#lines] = nil end
      if #lines > 0 then rec.tip = lines end
    end
  end
  seen[id] = true
  return rec
end

-- Record an item from any link. Returns the record, or nil until the client
-- has the item cached.
function items.see(link)
  local id = ids.itemLink(link)
  if not id or seen[id] then return nil end
  return record(link, id)
end

NS.on("GET_ITEM_INFO_RECEIVED", function(itemID, success)
  local link = pending[itemID]
  if not link then return end
  pending[itemID] = nil
  if success ~= false then record(link, itemID) end
end)

-- Bags and equipment: item discovery only; contents are never world data.
local function scanBags()
  for bag = 0, 4 do
    local n = compat.containerSlots(bag) or 0
    for slot = 1, n do
      local link = compat.containerItemLink(bag, slot)
      if link then items.see(link) end
    end
  end
end

local function scanEquipment()
  if not GetInventoryItemLink then return end
  for slot = 1, 19 do
    local link = GetInventoryItemLink("player", slot)
    if link then items.see(link) end
  end
end

NS.on("PLAYER_ENTERING_WORLD", function()
  C_Timer.After(6, function()
    scanBags()
    scanEquipment()
  end)
end)

NS.on("BAG_UPDATE_DELAYED", function()
  if throttle.allow("bags", 30) then scanBags() end
end)

NS.on("PLAYER_EQUIPMENT_CHANGED", function(slot)
  if GetInventoryItemLink and slot then
    local link = GetInventoryItemLink("player", slot)
    if link then items.see(link) end
  end
end)
