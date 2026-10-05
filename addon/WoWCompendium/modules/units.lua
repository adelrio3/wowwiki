-- Creatures: everything the client shows about units the player sees or
-- interacts with (docs/03 "Creatures"). Players are not recorded here in 0.1.
local _, NS = ...
local store, ids, compat, throttle = NS.store, NS.ids, NS.compat, NS.throttle

-- Per-session memory, reset on PLAYER_LOGIN: spawn UIDs per npcID, tooltip
-- scanned per npcID.
local spawns = {}
local tipDone = {}
local loreDone = {}
local lookDone = {}

NS.on("PLAYER_LOGIN", function()
  spawns = {}
  tipDone = {}
  loreDone = {}
  lookDone = {}
end)

local BEAST_LORE = 1462
local MAX_EXTRA_LINES = 12

-- Sight (N-0016, D-0036): the client exposes nearby units only through
-- nameplates, and the add-on never changes the player's nameplate or any other
-- client settings. Coverage of friendly NPCs therefore comes from mouseover,
-- targeting, and interaction during normal play. That is slower, and accepted.

local function levelKey(unit)
  local lvl = UnitLevel(unit)
  if lvl == nil then return nil end
  return tostring(lvl), lvl
end

local function scanTooltip(rec, unit)
  local lines = compat.unitTooltip(unit)
  if not lines then return end
  -- Line 2 is "Level N ..." for most units, or the subtitle for NPCs with a
  -- title ("Warrior Trainer", "Innkeeper"). Line 3 is usually the faction.
  local l2, l3 = lines[2], lines[3]
  if l2 and l2 ~= "" and not string.find(l2, "^" .. (LEVEL or "Level")) then
    rec.sub = l2
    if l3 and l3 ~= "" and not string.find(l3, "^" .. (LEVEL or "Level")) then rec.tf = l3 end
  elseif l3 and l3 ~= "" and l3 ~= (PVP or "PvP") then
    rec.tf = l3
  end
  -- Everything past the subtitle: faction, PvP, and what Beast Lore adds
  -- ("Tameable", "Diet: ...", pet skills with ranks). Kept as lines; the
  -- site reads them (D-0049).
  local extra = {}
  for i = 3, math.min(#lines, 2 + MAX_EXTRA_LINES) do
    local l = lines[i]
    if l and l ~= "" then extra[#extra + 1] = string.sub(l, 1, 120) end
  end
  if #extra > 0 and (not rec.tl or #extra > #rec.tl) then rec.tl = extra end
end

-- Full snapshot of a unit token; `kind` is how we came to see it.
local function snapshot(unit, kind)
  if not UnitExists(unit) then return end
  local guid = UnitGUID(unit)
  local p = ids.parse(guid)
  if not ids.isCreature(p) then return end
  -- Totems, minions, companions and charmed units carry Creature GUIDs but belong
  -- to a player; they are never world data (D-0038).
  if UnitPlayerControlled and UnitPlayerControlled(unit) then return end
  local rec = store.creature(p.id)
  if not rec then return end
  rec.gt = p.kind
  rec.n = (rec.n or 0) + 1
  rec.name = UnitName(unit) or rec.name

  local lkey, lvl = levelKey(unit)
  if lvl then
    if not rec.lmin or lvl < rec.lmin then rec.lmin = lvl end
    if not rec.lmax or lvl > rec.lmax then rec.lmax = lvl end
  end
  rec.cls = UnitClassification(unit) or rec.cls
  rec.ct = UnitCreatureType(unit) or rec.ct
  local fam = UnitCreatureFamily(unit)
  if fam then rec.cf = fam end
  local rx = UnitReaction("player", unit)
  if rx then rec.rx = rx end
  local fg = UnitFactionGroup(unit)
  if fg then rec.fg = fg end
  if UnitIsPVP and UnitIsPVP(unit) then rec.pvp = true end
  if UnitIsCivilian and UnitIsCivilian(unit) then rec.civ = true end
  -- Attackable is a strong NPC/creature signal: friendly townsfolk cannot be attacked.
  if UnitCanAttack then rec.atk = UnitCanAttack("player", unit) and true or false end
  if UnitSex then rec.sex = UnitSex(unit) end
  if UnitPowerType then rec.pt = UnitPowerType(unit) end

  -- Health and power only when full (undamaged), keyed by level.
  if lkey then
    local hp, hpMax = UnitHealth(unit), UnitHealthMax(unit)
    if hpMax and hpMax > 0 and hp == hpMax then
      rec.hp = rec.hp or {}
      rec.hp[lkey] = hpMax
    end
    local pwMax = UnitPowerMax and UnitPowerMax(unit)
    if pwMax and pwMax > 0 then
      rec.pw = rec.pw or {}
      rec.pw[lkey] = pwMax
    end
  end

  -- Distinct spawns.
  local set = spawns[p.id]
  if not set then set = {} spawns[p.id] = set end
  local newSpawn = not set[p.spawn]
  if newSpawn then
    set[p.spawn] = true
    rec.sp = (rec.sp or 0) + 1
  end

  -- Position: once per spawn per kind; interact kind always.
  if kind == "interact" or newSpawn then
    store.addPos(rec, store.pos(kind))
  end

  -- Tooltip once per npcID per session, never for nameplates; again once
  -- when Beast Lore is on the unit, since it adds lines.
  if kind ~= "nameplate" then
    if not tipDone[p.id] then
      tipDone[p.id] = true
      scanTooltip(rec, unit)
    elseif not loreDone[p.id] and compat.unitHasAura(unit, BEAST_LORE) then
      loreDone[p.id] = true
      scanTooltip(rec, unit)
    end
    -- The unit's look, once per npcID per session.
    if not lookDone[p.id] then
      lookDone[p.id] = true
      local di = compat.displayId(unit)
      if di then rec.di = di end
    end
  end
  return rec
end

NS.on("PLAYER_TARGET_CHANGED", function()
  snapshot("target", "target")
end)

NS.on("UPDATE_MOUSEOVER_UNIT", function()
  if UnitExists("mouseover") and not UnitIsUnit("mouseover", "player") then
    if throttle.allow("mouseover:" .. (UnitGUID("mouseover") or "?"), 5) then
      snapshot("mouseover", "mouseover")
    end
  end
end)

-- Beast Lore lands after the first look at the unit; rescan then.
NS.on("UNIT_AURA", function(unit)
  if unit == "target" and UnitExists("target") then
    local p = ids.parse(UnitGUID("target"))
    if ids.isCreature(p) and not loreDone[p.id] and compat.unitHasAura("target", BEAST_LORE) then
      snapshot("target", "target")
    end
  end
end)

NS.on("NAME_PLATE_UNIT_ADDED", function(unit)
  snapshot(unit, "nameplate")
end)

-- Interaction frames reveal roles (vendor, trainer, taxi, ...) and give a
-- close-range position for the NPC. The "npc" unit token stays set after a
-- window closes (N-0015), so quest events use "questnpc", which is the real
-- source of the quest (a creature GUID, or an Item GUID for item-started quests).
local function interaction(role, unit)
  unit = unit or "npc"
  if not UnitExists(unit) then return end
  local rec = snapshot(unit, "interact")
  if rec and role then
    rec.roles = rec.roles or {}
    rec.roles[role] = true
  end
end

local function questInteraction(role)
  local guid = UnitGUID("questnpc")
  if not guid then return end
  local p = ids.parse(guid)
  if not ids.isCreature(p) then return end -- item-started quest: no NPC role
  interaction(role, "questnpc")
end

NS.on("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", function(kind)
  local role = compat.interactionRoles[kind]
  if role == "quest" then questInteraction("quest") elseif role then interaction(role) end
end)
NS.on("GOSSIP_SHOW", function() interaction("gossip") end)
NS.on("QUEST_GREETING", function() questInteraction("quest") end)
NS.on("QUEST_DETAIL", function() questInteraction("quest") end)
NS.on("QUEST_PROGRESS", function() questInteraction("quest_end") end)
NS.on("QUEST_COMPLETE", function() questInteraction("quest_end") end)
NS.on("MERCHANT_SHOW", function() interaction("vendor") end)
NS.on("TRAINER_SHOW", function() interaction("trainer") end)
NS.on("TAXIMAP_OPENED", function() interaction("taxi") end)
NS.on("BANKFRAME_OPENED", function() interaction("bank") end)
NS.on("PET_STABLE_SHOW", function() interaction("stable_master") end)
NS.on("AUCTION_HOUSE_SHOW", function() interaction("auctioneer") end)
