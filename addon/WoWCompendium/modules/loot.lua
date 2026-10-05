-- Loot windows: every window the player opens, including empty ones, keyed by
-- the source that produced it, so the site can compute drop rates as
-- (windows with the item) / (windows from that source) (docs/03 "Loot").
-- One window per spawn per session: opening the same corpse twice counts once.
local _, NS = ...
local store, ids, compat = NS.store, NS.ids, NS.compat

local counted = {} -- source key -> { [spawn uid] = true }

NS.on("PLAYER_LOGIN", function() counted = {} end)

-- Loot sources of the open window as { key, kind, id, uid } records.
local function sourceOf(guid)
  local p = ids.parse(guid)
  if not p then return nil end
  if ids.isCreature(p) then return { key = "c:" .. p.id, k = "c", id = p.id, uid = p.spawn } end
  if p.kind == "GameObject" then return { key = "o:" .. p.id, k = "o", id = p.id, uid = p.spawn } end
  return nil
end

local function slotSources(i, fallback)
  local list = compat.lootSources(i)
  local out = {}
  if list and #list > 0 then
    for _, guid in ipairs(list) do
      local s = sourceOf(guid)
      if s then out[#out + 1] = s end
    end
  end
  if #out == 0 and fallback then out[1] = fallback end
  return out
end

local function fishingSource()
  local map = compat.playerMapPosition()
  return { key = "f:" .. tostring(map or 0), k = "f", id = map or 0, uid = tostring(NS.now()) .. ":" .. tostring(GetTime and GetTime() or 0) }
end

NS.on("LOOT_OPENED", function()
  local n = (GetNumLootItems and GetNumLootItems()) or 0
  local fishing = IsFishingLoot and IsFishingLoot()
  -- The window's own source when slots carry none: a fishing cast, or the dead target.
  local fallback
  if fishing then
    fallback = fishingSource()
  elseif UnitExists and UnitExists("target") and UnitIsDead and UnitIsDead("target") then
    fallback = sourceOf(UnitGUID("target"))
  end
  -- Which sources this window counts for, each once.
  local windowSources = {}
  local function windowFor(src)
    local w = windowSources[src.key]
    if w then return w end
    local set = counted[src.key]
    if not set then set = {} counted[src.key] = set end
    if set[src.uid] then
      w = { skip = true }
    else
      set[src.uid] = true
      local rec = store.loot(src.key, src.k, src.id)
      if not rec then w = { skip = true } else rec.w = (rec.w or 0) + 1; w = { rec = rec, items = {} } end
    end
    windowSources[src.key] = w
    return w
  end
  if fallback then windowFor(fallback) end
  for i = 1, n do
    if compat.lootSlotIsItem(i) then
      local link = GetLootSlotLink and GetLootSlotLink(i)
      local id = link and ids.itemLink(link)
      if id then
        if NS.items then NS.items.see(link) end
        local qty, quest = compat.lootSlot(i)
        for _, src in ipairs(slotSources(i, fallback)) do
          local w = windowFor(src)
          if not w.skip and not w.items[id] then
            w.items[id] = true
            local key = tostring(id)
            local it = w.rec.items[key]
            if not it then it = { n = 0 } w.rec.items[key] = it end
            it.n = it.n + 1
            qty = tonumber(qty) or 1
            if not it.min or qty < it.min then it.min = qty end
            if not it.max or qty > it.max then it.max = qty end
            if quest then it.q = true end
          end
        end
      end
    end
  end
end)

-- Journal: what this character received, for uncommon and better items.
local SELF = compat.patternFrom(LOOT_ITEM_SELF)
local SELF_MULTI = compat.patternFrom(LOOT_ITEM_SELF_MULTIPLE)

NS.on("CHAT_MSG_LOOT", function(text, _, _, _, player)
  if type(text) ~= "string" then return end
  local link, qty
  if SELF_MULTI then link, qty = string.match(text, SELF_MULTI) end
  if not link and SELF then link = string.match(text, SELF) end
  if not link then return end
  local id = ids.itemLink(link)
  if not id then return end
  local info = compat.itemInfo(link)
  if not info or (info.quality or 0) < 2 then return end
  store.event("loot", { item = id, n = tonumber(qty) or 1, name = info.name, q = info.quality }, true)
end)
