-- WoW Compendium Probe
-- Throwaway diagnostic add-on. It records which APIs and events this client
-- exposes, plus small samples of real event data, into SavedVariables so the
-- results can be read after /reload or logout. It has no UI beyond /cprobe.

local ADDON_NAME = ...
local PROBE_VERSION = 2
local MAX_SAMPLES = 5
local DB

-- ---------------------------------------------------------------- helpers

local function now()
  if GetServerTime then return GetServerTime() end
  return time()
end

local function resolve(path)
  local cur = _G
  for part in string.gmatch(path, "[^%.]+") do
    if type(cur) ~= "table" then return nil end
    cur = cur[part]
  end
  return cur
end

local function typeOf(path)
  local v = resolve(path)
  if v == nil then return "nil" end
  return type(v)
end

-- Call fn safely and return a table of results (or an error string).
local function try(fn, ...)
  if type(fn) ~= "function" then return { err = "not a function" } end
  local res = { pcall(fn, ...) }
  local ok = table.remove(res, 1)
  if not ok then return { err = tostring(res[1]) } end
  return res
end

-- Size-limited copy so SavedVariables stay small.
local function trim(v, depth, maxDepth, maxKeys)
  depth = depth or 0
  maxDepth = maxDepth or 5
  maxKeys = maxKeys or 64
  local t = type(v)
  if t == "string" then
    if #v > 300 then return string.sub(v, 1, 300) .. "..." end
    return v
  elseif t == "number" or t == "boolean" or t == "nil" then
    return v
  elseif t == "table" then
    if depth >= maxDepth then return "<table>" end
    local out, n = {}, 0
    for k, val in pairs(v) do
      n = n + 1
      if n > maxKeys then out["..."] = true break end
      out[tostring(k)] = trim(val, depth + 1, maxDepth, maxKeys)
    end
    return out
  else
    return "<" .. t .. ">"
  end
end

local function sample(bucket, record)
  DB.counts[bucket] = (DB.counts[bucket] or 0) + 1
  DB.samples[bucket] = DB.samples[bucket] or {}
  local list = DB.samples[bucket]
  if #list >= MAX_SAMPLES then return end
  record.t = now()
  list[#list + 1] = trim(record)
end

-- One sample per distinct key (for example per npcID), up to max.
local function sampleUnique(bucket, key, record, max)
  DB.counts[bucket] = (DB.counts[bucket] or 0) + 1
  DB.samples[bucket] = DB.samples[bucket] or {}
  local list = DB.samples[bucket]
  key = tostring(key)
  if list[key] then return end
  local n = 0
  for _ in pairs(list) do n = n + 1 end
  if n >= (max or 15) then return end
  record.t = now()
  list[key] = trim(record)
end

-- Hidden tooltip scanner: the classic way to read tooltip text when
-- C_TooltipInfo does not exist (it does not, on Classic Era 1.15).
local tip = CreateFrame("GameTooltip", "WoWCompendiumProbeTip", UIParent, "GameTooltipTemplate")
local function scanTip(method, ...)
  if type(tip[method]) ~= "function" then return { err = "no " .. method } end
  tip:SetOwner(UIParent, "ANCHOR_NONE")
  tip:ClearLines()
  local ok, err = pcall(tip[method], tip, ...)
  if not ok then tip:Hide(); return { err = tostring(err) } end
  local lines = {}
  for i = 1, tip:NumLines() do
    local left = _G["WoWCompendiumProbeTipTextLeft" .. i]
    local right = _G["WoWCompendiumProbeTipTextRight" .. i]
    local l = left and left:GetText()
    local r = right and right:GetText()
    lines[i] = r and (l .. " || " .. r) or l
  end
  local unitName, unitToken = tip:GetUnit()
  tip:Hide()
  return { n = #lines, lines = lines, unitName = unitName, unitToken = unitToken }
end

local function note(key, value)
  DB.notes[key] = trim(value)
end

-- ---------------------------------------------------------------- API existence

local API_PATHS = {
  -- identity / client
  "WOW_PROJECT_ID", "WOW_PROJECT_MAINLINE", "WOW_PROJECT_CLASSIC",
  "WOW_PROJECT_BURNING_CRUSADE_CLASSIC", "WOW_PROJECT_WRATH_CLASSIC",
  "WOW_PROJECT_CATACLYSM_CLASSIC", "WOW_PROJECT_MISTS_CLASSIC",
  "GetBuildInfo", "GetLocale", "GetCurrentRegion", "GetCurrentRegionName",
  "GetRealmName", "GetNormalizedRealmName", "GetAutoCompleteRealms",
  "GetServerTime", "BNGetInfo", "C_Seasons.HasActiveSeason",
  "C_Seasons.GetActiveSeason", "C_GameRules.IsHardcoreActive",
  "C_GameRules.GetGameRuleAsFloat", "C_AddOns.GetAddOnMetadata", "GetAddOnMetadata",
  "LE_EXPANSION_LEVEL_CURRENT", "GetAccountExpansionLevel", "GetExpansionLevel",
  -- tooltips
  "C_TooltipInfo.GetUnit", "C_TooltipInfo.GetItemByID", "C_TooltipInfo.GetSpellByID",
  "C_TooltipInfo.GetHyperlink", "C_TooltipInfo.GetInventoryItem",
  "C_TooltipInfo.GetMerchantItem", "C_TooltipInfo.GetQuestItem",
  "TooltipUtil.SurfaceArgs", "TooltipDataProcessor.AddTooltipPostCall",
  -- units
  "UnitGUID", "UnitName", "UnitLevel", "UnitClassification", "UnitCreatureType",
  "UnitCreatureFamily", "UnitReaction", "UnitFactionGroup", "UnitIsTapDenied",
  "UnitHealthMax", "UnitHealth", "UnitPowerType", "UnitPowerMax", "UnitSex",
  "UnitIsCivilian", "UnitIsPVP", "UnitIsPlayer", "UnitPVPName", "GetGuildInfo",
  "CheckInteractDistance", "NotifyInspect", "CanInspect", "GetInventoryItemLink",
  "C_PlayerInfo.GetClass", "C_PlayerInfo.IsPlayerNPERestricted",
  -- auras
  "C_UnitAuras.GetAuraDataByIndex", "C_UnitAuras.GetAuraDataBySlot",
  "C_UnitAuras.GetAuraSlots", "UnitAura", "UnitBuff", "UnitDebuff", "AuraUtil.ForEachAura",
  -- map / zones
  "C_Map.GetBestMapForUnit", "C_Map.GetPlayerMapPosition", "C_Map.GetMapInfo",
  "C_Map.GetMapChildrenInfo", "C_Map.GetAreaInfo", "C_Map.GetMapArtID",
  "C_Map.GetMapArtLayers", "C_Map.GetMapArtLayerTextures",
  "C_MapExplorationInfo.GetExploredMapTextures", "C_MapExplorationInfo.GetExploredAreaIDsAtPosition",
  "GetZoneText", "GetSubZoneText", "GetRealZoneText", "GetMinimapZoneText",
  "IsIndoors", "IsResting", "GetInstanceInfo", "GetBindLocation",
  "C_TaxiMap.GetAllTaxiNodes", "C_TaxiMap.GetTaxiNodesForMap", "NumTaxiNodes",
  "TaxiNodeName", "TaxiNodePosition", "TaxiNodeGetType", "TaxiNodeCost",
  "GetNumRoutes", "TaxiGetSrcX", "TaxiGetDestX", "TakeTaxiNode",
  -- quests
  "GetNumQuestLogEntries", "GetQuestLogTitle", "SelectQuestLogEntry",
  "GetQuestLogQuestText", "GetNumQuestLeaderBoards", "GetQuestLogLeaderBoard",
  "GetQuestLogRewardInfo", "GetQuestLogRewardMoney", "GetQuestLogRewardXP",
  "GetQuestLogRequiredMoney", "GetQuestLogGroupNum", "GetQuestLogTimeLeft",
  "GetQuestLogSelection", "GetQuestLogItemLink",
  "C_QuestLog.GetInfo", "C_QuestLog.GetNumQuestLogEntries", "C_QuestLog.GetTitleForQuestID",
  "C_QuestLog.GetQuestObjectives", "C_QuestLog.GetAllCompletedQuestIDs",
  "C_QuestLog.IsQuestFlaggedCompleted", "C_QuestLog.GetQuestInfo",
  "C_QuestLog.GetSelectedQuest", "C_QuestLog.SetSelectedQuest", "C_QuestLog.GetQuestTagInfo",
  "C_QuestLog.GetLogIndexForQuestID", "C_QuestLog.GetQuestsOnMap", "GetQuestsCompleted",
  "GetQuestID", "GetTitleText", "GetQuestText", "GetObjectiveText", "GetRewardText",
  "GetProgressText", "GetNumQuestRewards", "GetNumQuestChoices", "GetQuestItemLink",
  "GetQuestItemInfo", "GetRewardMoney", "GetRewardXP", "GetRewardSpell", "GetRewardTitle",
  "GetRewardHonor", "GetNumRewardCurrencies", "GetNumQuestItems", "GetQuestMoneyToGet",
  "GetNumRewardSpells", "GetRewardSpellInfo", "C_QuestOffer.GetQuestRewardSpells",
  "C_QuestOffer.GetQuestRewardSpellInfo", "C_QuestInfoSystem.GetQuestRewardSpells",
  "C_QuestLog.GetQuestRewardSpells", "GetQuestLogRewardSpell", "C_QuestOffer.GetQuestRequiredCurrencyInfo",
  "GetNumAvailableQuests", "GetAvailableTitle", "GetAvailableQuestInfo",
  "GetNumActiveQuests", "GetActiveTitle", "GetActiveQuestID", "IsQuestCompletable",
  "GetSuggestedGroupNum", "QuestGetAutoAccept", "GetQuestPortraitGiver",
  -- gossip
  "C_GossipInfo.GetText", "C_GossipInfo.GetOptions", "C_GossipInfo.GetAvailableQuests",
  "C_GossipInfo.GetActiveQuests", "C_GossipInfo.SelectOption", "C_GossipInfo.GetNumOptions",
  "GetGossipText", "GetGossipOptions",
  -- vendor / trainer
  "GetMerchantNumItems", "GetMerchantItemInfo", "GetMerchantItemLink",
  "GetMerchantItemCostInfo", "GetMerchantItemCostItem", "CanMerchantRepair",
  "C_MerchantFrame.GetItemInfo", "C_MerchantFrame.GetNumItems",
  "GetNumTrainerServices", "GetTrainerServiceInfo", "GetTrainerServiceCost",
  "GetTrainerServiceLevelReq", "GetTrainerServiceSkillReq", "GetTrainerServiceItemLink",
  "GetTrainerServiceTypeFilter", "SetTrainerServiceTypeFilter", "GetTrainerServiceSkillLine",
  "GetTrainerServiceAbilityReq", "GetTrainerServiceNumAbilityReq", "GetTrainerServiceDescription",
  -- loot
  "GetNumLootItems", "GetLootSlotInfo", "GetLootSlotLink", "GetLootSlotType",
  "GetLootSourceInfo", "IsFishingLoot", "LootSlot",
  -- items
  "GetItemInfo", "GetItemInfoInstant", "C_Item.GetItemInfo", "C_Item.GetItemInfoInstant",
  "C_Item.GetItemNameByID", "C_Item.GetItemIconByID", "C_Item.RequestLoadItemDataByID",
  "C_Item.IsItemDataCachedByID", "GetItemSpell", "GetItemSetInfo", "GetItemStats",
  "C_Item.GetItemStats", "GetContainerNumSlots", "GetContainerItemInfo", "GetContainerItemLink",
  "C_Container.GetContainerNumSlots", "C_Container.GetContainerItemInfo",
  "C_Container.GetContainerItemLink", "C_Container.UseContainerItem", "UseContainerItem",
  -- spells / talents
  "GetSpellInfo", "C_Spell.GetSpellInfo", "GetSpellDescription", "C_Spell.GetSpellDescription",
  "GetSpellLink", "C_Spell.GetSpellLink", "GetNumSpellTabs", "GetSpellTabInfo",
  "GetSpellBookItemInfo", "GetSpellBookItemName", "C_SpellBook.GetSpellBookItemInfo",
  "C_SpellBook.GetNumSpellBookSkillLines", "GetNumTalentTabs", "GetTalentTabInfo",
  "GetTalentInfo", "GetNumTalents", "C_ClassTalents.GetActiveConfigID", "C_Traits.GetConfigInfo",
  "GetNumGlyphSockets", "GetGlyphSocketInfo", "GetActiveTalentGroup", "GetNumTalentGroups",
  -- combat log
  "CombatLogGetCurrentEventInfo", "COMBATLOG_OBJECT_TYPE_NPC",
  -- professions / reputation / skills
  "GetNumSkillLines", "GetSkillLineInfo", "GetProfessions", "GetProfessionInfo",
  "GetNumTradeSkills", "GetTradeSkillInfo", "GetTradeSkillItemLink", "GetTradeSkillRecipeLink",
  "GetTradeSkillNumMade", "GetTradeSkillNumReagents", "GetTradeSkillReagentInfo",
  "GetTradeSkillReagentItemLink", "GetTradeSkillCooldown", "GetTradeSkillTools",
  "GetTradeSkillLine", "GetNumCrafts", "GetCraftInfo", "GetCraftItemLink", "GetCraftReagentInfo",
  "GetCraftDescription", "GetCraftDisplaySkillLine", "C_TradeSkillUI.GetAllRecipeIDs",
  "C_TradeSkillUI.GetRecipeInfo", "C_TradeSkillUI.GetRecipeSchematic",
  "GetNumFactions", "GetFactionInfo", "GetFactionInfoByID", "C_Reputation.GetFactionDataByIndex",
  "C_Reputation.GetFactionDataByID", "C_Reputation.GetNumFactions", "GetWatchedFactionInfo",
  -- character
  "RequestTimePlayed", "GetMoney", "GetNumTitles", "GetTitleName", "IsTitleKnown",
  "GetCurrentTitle", "GetPVPLifetimeStats", "GetPVPSessionStats", "GetPVPYesterdayStats",
  "GetPVPRankInfo", "UnitPVPRank", "GetHonorCurrency", "C_CurrencyInfo.GetCurrencyInfo",
  "GetXPExhaustion", "UnitXP", "UnitXPMax", "GetRestState", "C_PvP.GetHonorExhaustion",
  -- social
  "GetNumGroupMembers", "GetRaidRosterInfo", "IsInRaid", "IsInGroup", "UnitInParty",
  "GetInboxNumItems", "GetInboxHeaderInfo", "GetInboxText", "GetInboxItem", "GetInboxItemLink",
  -- lore text
  "ItemTextGetItem", "ItemTextGetCreator", "ItemTextGetMaterial", "ItemTextGetPage",
  "ItemTextGetText", "ItemTextHasNextPage", "ItemTextNextPage",
  -- achievements / collections / journal
  "GetAchievementInfo", "GetCategoryList", "GetAchievementNumCriteria",
  "GetAchievementCriteriaInfo", "GetStatistic", "GetNumCompletedAchievements",
  "C_MountJournal.GetNumMounts", "C_PetJournal.GetNumPets", "C_ToyBox.GetNumToys",
  "C_TransmogCollection.GetCategoryTotal", "EJ_GetInstanceInfo", "EJ_GetNumTiers",
  "C_EncounterJournal.GetSectionInfo", "C_EncounterJournal.GetEncountersOnMap",
  -- pvp
  "GetNumBattlefieldScores", "GetBattlefieldScore", "GetBattlefieldWinner",
  "GetBattlefieldStatus", "C_PvP.IsBattleground", "C_PvP.GetActiveMatchState",
  "GetNumBattlefieldStats", "GetBattlefieldStatInfo", "C_PvP.GetMatchPVPStatColumns",
  -- misc
  "C_Timer.After", "C_Timer.NewTicker", "hooksecurefunc", "C_PlayerInteractionManager.IsInteractingWithNpcOfType",
  "GameTooltip.SetUnit", "GameTooltip.SetHyperlink", "GameTooltip.SetItemByID", "GameTooltip.SetSpellByID",
  "GameTooltip.SetLootItem", "GameTooltip.SetMerchantItem", "GameTooltip.SetTrainerService",
  "GameTooltip.SetInventoryItem", "GameTooltip.SetBagItem", "GameTooltip.SetQuestItem",
  "GameTooltip.SetQuestLogItem", "GameTooltip.SetTradeSkillItem", "GameTooltip.SetCraftItem",
  "GameTooltip.SetTalent", "GameTooltip.SetSpellBookItem", "GameTooltip.SetUnitAura",
  "GameTooltip.GetUnit", "GameTooltip.GetItem", "GameTooltip.GetSpell", "GameTooltip.NumLines",
  "C_Map.GetWorldPosFromMapPos", "C_Map.GetMapPosFromWorldPos", "UnitPosition",
  "GetAreaText", "C_ZoneInfo.GetAreaInfo", "GetSubZoneText", "C_PvP.GetZonePVPInfo", "GetZonePVPInfo",
  "C_Spell.RequestLoadSpellData", "C_Spell.IsSpellDataCached", "GetSpellTexture", "C_Spell.GetSpellTexture",
  "GetSpellRank", "C_Spell.GetSpellSubtext", "GetSpellSubtext",
  "GetNumCompanions", "C_PetJournal.GetNumPets", "GetNumMacros",
  "C_GameRules.IsGameRuleActive", "C_GameRules.GetGameRuleAsString", "C_Seasons.GetSeasonName",
  "UnitIsHardcore", "C_Reputation.IsFactionParagon", "GetFriendshipReputation",
  "C_PlayerInteractionManager.GetInteractionType", "C_Calendar.GetNumDayEvents",
  "C_DateAndTime.GetServerTimeLocal", "C_DateAndTime.GetCurrentCalendarTime",
  "GetCVar", "C_CVar.GetCVar", "GetGameTime", "GetRealmID", "C_ChatInfo.SendAddonMessage",
  "C_Scenario.GetInfo", "GetDifficultyInfo", "GetDungeonDifficultyID", "GetRaidDifficultyID",
}

local function probeAPIs()
  DB.api = {}
  for _, path in ipairs(API_PATHS) do
    DB.api[path] = typeOf(path)
  end
end

-- ---------------------------------------------------------------- login snapshot

local function snapshotUnit(unit)
  local r = { unit = unit }
  r.guid = UnitGUID(unit)
  r.name = UnitName(unit)
  r.level = UnitLevel(unit)
  r.classification = UnitClassification(unit)
  r.creatureType = UnitCreatureType(unit)
  r.creatureFamily = UnitCreatureFamily(unit)
  r.reaction = UnitReaction("player", unit)
  r.healthMax = UnitHealthMax(unit)
  r.health = UnitHealth(unit)
  r.powerType = UnitPowerType(unit)
  r.powerMax = UnitPowerMax(unit)
  r.isPlayer = UnitIsPlayer(unit)
  if UnitIsTapDenied then r.tapDenied = UnitIsTapDenied(unit) end
  if UnitIsCivilian then r.civilian = UnitIsCivilian(unit) end
  if UnitSex then r.sex = UnitSex(unit) end
  if C_TooltipInfo and C_TooltipInfo.GetUnit then
    local res = try(C_TooltipInfo.GetUnit, unit)
    local data = res[1]
    if res.err then
      r.tooltipErr = res.err
    elseif type(data) == "table" and type(data.lines) == "table" then
      r.tooltipLines = {}
      for i = 1, math.min(#data.lines, 5) do
        local line = data.lines[i]
        if line.leftText == nil and TooltipUtil and TooltipUtil.SurfaceArgs then
          pcall(TooltipUtil.SurfaceArgs, line)
        end
        r.tooltipLines[i] = line.leftText or "<no leftText>"
      end
      r.tooltipGuid = data.guid
      r.tooltipType = data.type
    else
      r.tooltipErr = "no data"
    end
  end
  if C_Map and C_Map.GetBestMapForUnit then
    r.mapID = C_Map.GetBestMapForUnit("player")
    if r.mapID and C_Map.GetPlayerMapPosition then
      local pos = C_Map.GetPlayerMapPosition(r.mapID, "player")
      if pos then r.x, r.y = pos:GetXY() end
    end
  end
  if CheckInteractDistance then
    local res = try(CheckInteractDistance, unit, 3)
    r.interact3 = res.err or res[1]
  end
  r.tip = scanTip("SetUnit", unit)
  return r
end

local function npcIDFromGUID(guid)
  if not guid then return nil end
  local kind, id = string.match(guid, "^(%a+)%-0%-%d+%-%d+%-%d+%-(%d+)%-")
  return id and (kind .. ":" .. id) or guid
end

local function probeValues()
  local V = {}
  V.projectID = WOW_PROJECT_ID
  V.projectConstants = {
    mainline = WOW_PROJECT_MAINLINE, classic = WOW_PROJECT_CLASSIC,
    tbc = WOW_PROJECT_BURNING_CRUSADE_CLASSIC, wrath = WOW_PROJECT_WRATH_CLASSIC,
    cata = WOW_PROJECT_CATACLYSM_CLASSIC, mists = WOW_PROJECT_MISTS_CLASSIC,
  }
  V.buildInfo = try(GetBuildInfo)
  V.locale = GetLocale()
  V.expansionLevelCurrent = LE_EXPANSION_LEVEL_CURRENT
  if GetExpansionLevel then V.expansionLevel = try(GetExpansionLevel)[1] end
  if C_AddOns and C_AddOns.GetAddOnMetadata then
    V.tocVariant = C_AddOns.GetAddOnMetadata(ADDON_NAME, "X-Toc")
    V.tocInterface = C_AddOns.GetAddOnMetadata(ADDON_NAME, "Interface")
  end
  if C_Seasons then
    if C_Seasons.HasActiveSeason then V.hasActiveSeason = try(C_Seasons.HasActiveSeason)[1] end
    if C_Seasons.GetActiveSeason then V.activeSeason = try(C_Seasons.GetActiveSeason)[1] end
  end
  if C_GameRules and C_GameRules.IsHardcoreActive then V.hardcore = try(C_GameRules.IsHardcoreActive)[1] end
  if UnitIsHardcore then V.unitIsHardcore = try(UnitIsHardcore, "player")[1] end
  V.playerGUID = UnitGUID("player")
  V.playerName = UnitName("player")
  V.playerLevel = UnitLevel("player")
  V.playerClass = try(UnitClass, "player")
  V.playerRace = try(UnitRace, "player")
  V.playerFaction = try(UnitFactionGroup, "player")
  V.realm = GetRealmName()
  if GetNormalizedRealmName then V.realmNormalized = GetNormalizedRealmName() end
  if GetRealmID then V.realmID = try(GetRealmID)[1] end
  if GetCurrentRegion then V.region = GetCurrentRegion() end
  if GetCurrentRegionName then V.regionName = GetCurrentRegionName() end
  if GetAutoCompleteRealms then V.connectedRealms = try(GetAutoCompleteRealms) end
  V.serverTime = now()
  DB.values = trim(V, 0, 6, 200)
end

local function probeLogin()
  local L = {}
  L.addon = ADDON_NAME
  if C_AddOns and C_AddOns.GetAddOnMetadata then
    L.tocVariant = C_AddOns.GetAddOnMetadata(ADDON_NAME, "X-Toc")
  elseif GetAddOnMetadata then
    L.tocVariant = GetAddOnMetadata(ADDON_NAME, "X-Toc")
  end
  L.projectID = WOW_PROJECT_ID
  L.buildInfo = try(GetBuildInfo)
  L.locale = GetLocale()
  if GetCurrentRegion then L.region = GetCurrentRegion() end
  if GetCurrentRegionName then L.regionName = GetCurrentRegionName() end
  L.realm = GetRealmName()
  if GetNormalizedRealmName then L.realmNormalized = GetNormalizedRealmName() end
  if GetAutoCompleteRealms then L.connectedRealms = try(GetAutoCompleteRealms) end
  if GetRealmID then L.realmID = try(GetRealmID)[1] end
  L.serverTime = now()
  L.playerGUID = UnitGUID("player")
  L.playerName = UnitName("player")
  L.playerLevel = UnitLevel("player")
  L.playerClass = select(2, UnitClass("player"))
  L.playerRace = select(2, UnitRace("player"))
  L.playerFaction = UnitFactionGroup("player")
  if BNGetInfo then
    local res = try(BNGetInfo)
    L.hasBattleTag = (res.err == nil) and (type(res[2]) == "string") or false
  end
  if C_Seasons then
    if C_Seasons.HasActiveSeason then L.hasActiveSeason = try(C_Seasons.HasActiveSeason)[1] end
    if C_Seasons.GetActiveSeason then L.activeSeason = try(C_Seasons.GetActiveSeason)[1] end
  end
  if C_GameRules and C_GameRules.IsHardcoreActive then
    L.hardcore = try(C_GameRules.IsHardcoreActive)[1]
  end
  if GetAccountExpansionLevel then L.accountExpansion = GetAccountExpansionLevel() end
  L.expansionLevelCurrent = LE_EXPANSION_LEVEL_CURRENT

  -- hidden tooltip scans (C_TooltipInfo is absent on Era)
  L.tipItemHyperlink = scanTip("SetHyperlink", "item:6948")
  L.tipItemByID = scanTip("SetItemByID", 6948)
  L.tipSpellHyperlink = scanTip("SetHyperlink", "spell:8690")
  L.tipSpellByID = scanTip("SetSpellByID", 8690)
  L.tipInventory16 = scanTip("SetInventoryItem", "player", 16)
  L.tipPlayer = scanTip("SetUnit", "player")

  -- catalogs that may be stubs on Era
  if GetCategoryList then
    local res = try(GetCategoryList)
    L.achievementCategories = res.err or (type(res[1]) == "table" and #res[1]) or "?"
  end
  if GetNumCompletedAchievements then L.achievementsCompleted = try(GetNumCompletedAchievements) end
  if GetAchievementInfo then L.achievement6 = try(GetAchievementInfo, 6) end
  if C_MountJournal and C_MountJournal.GetNumMounts then L.numMounts = try(C_MountJournal.GetNumMounts) end
  if EJ_GetNumTiers then L.ejTiers = try(EJ_GetNumTiers) end
  if GetNumCompanions then L.companions = try(GetNumCompanions, "CRITTER") end

  -- item + spell info on a known item (Hearthstone 6948) and spell (Hearthstone 8690)
  L.itemInfo = try(GetItemInfo, 6948)
  if C_Item and C_Item.GetItemInfo then L.itemInfoC = try(C_Item.GetItemInfo, 6948) end
  if GetItemInfoInstant then L.itemInfoInstant = try(GetItemInfoInstant, 6948) end
  L.spellInfo = try(GetSpellInfo, 8690)
  if C_Spell and C_Spell.GetSpellInfo then L.spellInfoC = try(C_Spell.GetSpellInfo, 8690) end
  if C_TooltipInfo then
    if C_TooltipInfo.GetItemByID then
      local res = try(C_TooltipInfo.GetItemByID, 6948)
      local d = res[1]
      L.itemTooltipLines = res.err or (type(d) == "table" and d.lines and #d.lines) or "no lines"
      if type(d) == "table" and d.lines and d.lines[1] then
        local line = d.lines[1]
        if line.leftText == nil and TooltipUtil and TooltipUtil.SurfaceArgs then pcall(TooltipUtil.SurfaceArgs, line) end
        L.itemTooltipFirst = line.leftText
      end
    end
    if C_TooltipInfo.GetSpellByID then
      local res = try(C_TooltipInfo.GetSpellByID, 8690)
      local d = res[1]
      L.spellTooltipLines = res.err or (type(d) == "table" and d.lines and #d.lines) or "no lines"
    end
  end

  -- quest log detail: first real quest
  if GetNumQuestLogEntries and GetQuestLogTitle then
    local n = GetNumQuestLogEntries()
    for i = 1, (n or 0) do
      local info = try(GetQuestLogTitle, i)
      if not info.err and info[1] and not info[4] then
        L.questLogFirst = { index = i, title = info }
        if SelectQuestLogEntry then pcall(SelectQuestLogEntry, i) end
        if GetQuestLogQuestText then L.questLogFirst.text = try(GetQuestLogQuestText) end
        if GetNumQuestLeaderBoards then
          L.questLogFirst.numObjectives = try(GetNumQuestLeaderBoards, i)[1]
          if GetQuestLogLeaderBoard then L.questLogFirst.objective1 = try(GetQuestLogLeaderBoard, 1, i) end
        end
        if GetQuestLogRewardInfo then L.questLogFirst.reward1 = try(GetQuestLogRewardInfo, 1) end
        if GetQuestLogRewardMoney then L.questLogFirst.money = try(GetQuestLogRewardMoney) end
        if GetQuestLogRewardXP then L.questLogFirst.xp = try(GetQuestLogRewardXP) end
        local qid = info[8]
        if qid and C_QuestLog then
          if C_QuestLog.GetQuestObjectives then L.questLogFirst.cObjectives = try(C_QuestLog.GetQuestObjectives, qid) end
          if C_QuestLog.GetQuestInfo then L.questLogFirst.cInfo = try(C_QuestLog.GetQuestInfo, qid) end
        end
        break
      end
    end
  end

  -- exploration by position
  if C_MapExplorationInfo and C_MapExplorationInfo.GetExploredAreaIDsAtPosition and C_Map and C_Map.GetBestMapForUnit then
    local map = C_Map.GetBestMapForUnit("player")
    local pos = map and C_Map.GetPlayerMapPosition(map, "player")
    if pos then
      local res = try(C_MapExplorationInfo.GetExploredAreaIDsAtPosition, map, pos)
      L.exploredAreaIDsHere = res
      if type(res[1]) == "table" and res[1][1] and C_Map.GetAreaInfo then
        L.exploredAreaHereName = try(C_Map.GetAreaInfo, res[1][1])
      end
    end
  end
  if UnitPosition then L.unitPosition = try(UnitPosition, "player") end

  -- spellbook / talents
  if GetNumSpellTabs then L.spellTabs = try(GetNumSpellTabs)[1] end
  if GetSpellBookItemInfo then L.spellBookItem1 = try(GetSpellBookItemInfo, 1, "spell") end
  if GetNumTalentTabs then
    L.talentTabs = try(GetNumTalentTabs)[1]
    if GetTalentInfo then L.talent11 = try(GetTalentInfo, 1, 1) end
    if GetNumTalents then L.talentsTab1 = try(GetNumTalents, 1)[1] end
  end

  -- quests
  if GetNumQuestLogEntries then L.questLogEntries = try(GetNumQuestLogEntries) end
  if GetQuestLogTitle then L.questLogTitle1 = try(GetQuestLogTitle, 1) end
  if C_QuestLog then
    if C_QuestLog.GetInfo then L.questLogInfo1 = try(C_QuestLog.GetInfo, 1) end
    if C_QuestLog.GetAllCompletedQuestIDs then
      local res = try(C_QuestLog.GetAllCompletedQuestIDs)
      L.completedQuests = res.err or (type(res[1]) == "table" and #res[1]) or "?"
    end
  end
  if GetQuestsCompleted then
    local res = try(GetQuestsCompleted)
    local n = 0
    if type(res[1]) == "table" then for _ in pairs(res[1]) do n = n + 1 end end
    L.completedQuestsLegacy = res.err or n
  end

  -- factions / skills / titles / pvp
  if GetNumFactions then
    L.numFactions = try(GetNumFactions)[1]
    if GetFactionInfo then
      for i = 1, (L.numFactions or 0) do
        local res = try(GetFactionInfo, i)
        if not res.err and res[1] and not res[9] then L.factionSample = res; L.factionSampleIndex = i; break end
      end
    end
  end
  if C_Reputation and C_Reputation.GetFactionDataByIndex then
    L.factionDataC = try(C_Reputation.GetFactionDataByIndex, 1)
  end
  if GetNumSkillLines then
    L.numSkillLines = try(GetNumSkillLines)[1]
    if GetSkillLineInfo then
      for i = 1, (L.numSkillLines or 0) do
        local res = try(GetSkillLineInfo, i)
        if not res.err and res[1] and not res[2] then L.skillSample = res; break end
      end
    end
  end
  if GetNumTitles then L.numTitles = try(GetNumTitles)[1] end
  if GetPVPLifetimeStats then L.pvpLifetime = try(GetPVPLifetimeStats) end
  if UnitPVPRank then
    L.pvpRank = try(UnitPVPRank, "player")
    if GetPVPRankInfo and L.pvpRank[1] then L.pvpRankInfo = try(GetPVPRankInfo, L.pvpRank[1]) end
  end
  if C_TaxiMap and C_TaxiMap.GetAllTaxiNodes and C_Map and C_Map.GetBestMapForUnit then
    local map = C_Map.GetBestMapForUnit("player")
    local res = try(C_TaxiMap.GetAllTaxiNodes, map)
    L.taxiAllNodes = res.err or (type(res[1]) == "table" and #res[1]) or "?"
    if C_TaxiMap.GetTaxiNodesForMap then
      local r2 = try(C_TaxiMap.GetTaxiNodesForMap, map)
      L.taxiNodesForMap = r2.err or (type(r2[1]) == "table" and #r2[1]) or "?"
      if type(r2[1]) == "table" and r2[1][1] then L.taxiNodeForMap1 = r2[1][1] end
    end
  end
  if GetMoney then L.money = GetMoney() end
  if GetBindLocation then L.bindLocation = try(GetBindLocation)[1] end
  L.equippedMainHand = try(GetInventoryItemLink, "player", 16)
  if C_Container and C_Container.GetContainerNumSlots then
    L.bag0Slots = try(C_Container.GetContainerNumSlots, 0)[1]
    if C_Container.GetContainerItemInfo then L.bag0Slot1 = try(C_Container.GetContainerItemInfo, 0, 1) end
  elseif GetContainerNumSlots then
    L.bag0Slots = try(GetContainerNumSlots, 0)[1]
    if GetContainerItemInfo then L.bag0Slot1 = try(GetContainerItemInfo, 0, 1) end
  end

  -- map / exploration
  if C_Map and C_Map.GetBestMapForUnit then
    L.mapID = C_Map.GetBestMapForUnit("player")
    if L.mapID then
      if C_Map.GetMapInfo then L.mapInfo = try(C_Map.GetMapInfo, L.mapID) end
      if C_Map.GetMapChildrenInfo then
        local res = try(C_Map.GetMapChildrenInfo, L.mapID)
        L.mapChildren = res.err or (type(res[1]) == "table" and #res[1]) or "?"
      end
      if C_MapExplorationInfo and C_MapExplorationInfo.GetExploredMapTextures then
        local res = try(C_MapExplorationInfo.GetExploredMapTextures, L.mapID)
        L.exploredTextures = res.err or (type(res[1]) == "table" and #res[1]) or "nil"
        if type(res[1]) == "table" and res[1][1] then L.exploredTextureSample = res[1][1] end
      end
      if C_Map.GetPlayerMapPosition then
        local pos = C_Map.GetPlayerMapPosition(L.mapID, "player")
        if pos then L.x, L.y = pos:GetXY() end
      end
    end
  end
  L.zoneText = GetZoneText()
  L.subZoneText = GetSubZoneText()
  L.realZoneText = GetRealZoneText()
  L.instanceInfo = try(GetInstanceInfo)
  if GetNumGroupMembers then L.groupMembers = GetNumGroupMembers() end

  DB.login = trim(L, 0, 6, 500)
  DB.loginAt = now()
end

-- ---------------------------------------------------------------- events

local frame = CreateFrame("Frame")
local combatCounts = {}

local EVENTS = {
  "PLAYER_LOGIN", "PLAYER_LOGOUT", "PLAYER_ENTERING_WORLD",
  "PLAYER_TARGET_CHANGED", "UPDATE_MOUSEOVER_UNIT", "NAME_PLATE_UNIT_ADDED",
  "LOOT_OPENED", "LOOT_CLOSED", "LOOT_SLOT_CLEARED", "CHAT_MSG_LOOT", "CHAT_MSG_MONEY",
  "QUEST_DETAIL", "QUEST_PROGRESS", "QUEST_COMPLETE", "QUEST_GREETING", "QUEST_FINISHED",
  "QUEST_ACCEPTED", "QUEST_TURNED_IN", "QUEST_REMOVED", "QUEST_LOG_UPDATE",
  "GOSSIP_SHOW", "GOSSIP_CLOSED", "MERCHANT_SHOW", "MERCHANT_UPDATE", "TRAINER_SHOW",
  "TRAINER_UPDATE", "TAXIMAP_OPENED", "TAXIMAP_CLOSED", "ITEM_TEXT_BEGIN", "ITEM_TEXT_READY",
  "CHAT_MSG_MONSTER_SAY", "CHAT_MSG_MONSTER_YELL", "CHAT_MSG_MONSTER_EMOTE",
  "CHAT_MSG_MONSTER_WHISPER", "CHAT_MSG_RAID_BOSS_EMOTE", "CHAT_MSG_RAID_BOSS_WHISPER",
  "ENCOUNTER_START", "ENCOUNTER_END", "BOSS_KILL", "COMBAT_LOG_EVENT_UNFILTERED",
  "PLAYER_DEAD", "PLAYER_ALIVE", "PLAYER_UNGHOST", "UI_INFO_MESSAGE", "UI_ERROR_MESSAGE",
  "ZONE_CHANGED", "ZONE_CHANGED_NEW_AREA", "ZONE_CHANGED_INDOORS",
  "UNIT_AURA", "SPELLS_CHANGED", "LEARNED_SPELL_IN_TAB", "UNIT_SPELLCAST_SUCCEEDED",
  "TRADE_SKILL_SHOW", "TRADE_SKILL_UPDATE", "CRAFT_SHOW", "CRAFT_UPDATE",
  "UPDATE_FACTION", "CHAT_MSG_COMBAT_FACTION_CHANGE", "SKILL_LINES_CHANGED", "CHAT_MSG_SKILL",
  "PLAYER_LEVEL_UP", "PLAYER_MONEY", "PLAYER_EQUIPMENT_CHANGED", "TIME_PLAYED_MSG",
  "KNOWN_TITLES_UPDATE", "BAG_UPDATE", "GET_ITEM_INFO_RECEIVED", "ITEM_DATA_LOAD_RESULT",
  "GROUP_ROSTER_UPDATE", "INSPECT_READY", "MAIL_INBOX_UPDATE", "MAIL_SHOW",
  "PLAYER_PVP_KILLS_CHANGED", "CHAT_MSG_COMBAT_HONOR_GAIN", "UPDATE_BATTLEFIELD_STATUS",
  "UPDATE_BATTLEFIELD_SCORE", "PVP_MATCH_COMPLETE", "DUEL_FINISHED", "DUEL_REQUESTED",
  "ACHIEVEMENT_EARNED", "CRITERIA_UPDATE", "PLAYER_CONTROL_LOST", "PLAYER_CONTROL_GAINED",
  "CINEMATIC_START", "PLAYER_INTERACTION_MANAGER_FRAME_SHOW", "PLAYER_INTERACTION_MANAGER_FRAME_HIDE",
  "QUEST_DATA_LOAD_RESULT", "AREA_POIS_UPDATED", "CHAT_MSG_SYSTEM", "UNIT_QUEST_LOG_CHANGED",
  "BANKFRAME_OPENED", "AUCTION_HOUSE_SHOW", "PET_STABLE_SHOW", "CONFIRM_XP_LOSS",
  "RESURRECT_REQUEST", "CORPSE_IN_RANGE", "PLAYER_FLAGS_CHANGED", "UNIT_FACTION",
  "HARDCORE_DEATH", "SEASON_INFO_UPDATE",
  "LEARNED_SPELL_IN_SKILL_LINE", "NEW_RECIPE_LEARNED", "PLAYER_XP_UPDATE", "ITEM_PUSH",
  "CHAT_MSG_MONSTER_PARTY", "GOSSIP_CONFIRM", "PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED",
  "QUEST_WATCH_UPDATE", "QUEST_ITEM_UPDATE", "TRADE_SKILL_LIST_UPDATE", "UNIT_INVENTORY_CHANGED",
  "CHAT_MSG_TEXT_EMOTE", "TAXIMAP_OPENED", "PLAYER_UPDATE_RESTING", "DISCOVERY_PLAYER_SHOW",
}

local function registerAll()
  DB.events = {}
  for _, ev in ipairs(EVENTS) do
    local ok, err = pcall(frame.RegisterEvent, frame, ev)
    if ok then DB.events[ev] = "registered" else DB.events[ev] = "unknown" end
  end
end

local handlers = {}

handlers.PLAYER_TARGET_CHANGED = function()
  if UnitExists("target") then
    sampleUnique("target", npcIDFromGUID(UnitGUID("target")), snapshotUnit("target"), 20)
  end
end
handlers.UPDATE_MOUSEOVER_UNIT = function()
  if UnitExists("mouseover") then
    if not UnitIsUnit("mouseover", "player") then
      sampleUnique("mouseover", npcIDFromGUID(UnitGUID("mouseover")), snapshotUnit("mouseover"), 20)
    end
  else
    -- no unit: probably a game object (chest, herb, vein, sign). Read the live tooltip.
    local l1 = GameTooltipTextLeft1 and GameTooltipTextLeft1:GetText()
    if l1 then
      local r = { line1 = l1 }
      local l2 = GameTooltipTextLeft2 and GameTooltipTextLeft2:GetText()
      r.line2 = l2
      if GameTooltip.GetUnit then r.tipUnit = try(GameTooltip.GetUnit, GameTooltip) end
      if C_Map and C_Map.GetBestMapForUnit then
        r.mapID = C_Map.GetBestMapForUnit("player")
        local pos = r.mapID and C_Map.GetPlayerMapPosition(r.mapID, "player")
        if pos then r.x, r.y = pos:GetXY() end
      end
      sampleUnique("mouseoverObject", l1, r, 20)
    end
  end
end
handlers.NAME_PLATE_UNIT_ADDED = function(unit)
  sampleUnique("nameplate", npcIDFromGUID(UnitGUID(unit)), { unit = unit, guid = UnitGUID(unit), name = UnitName(unit), level = UnitLevel(unit) }, 20)
end

handlers.LOOT_OPENED = function(autoLoot)
  local r = { autoLoot = autoLoot, n = GetNumLootItems(), slots = {} }
  if IsFishingLoot then r.fishing = IsFishingLoot() end
  for i = 1, math.min(r.n or 0, 6) do
    local s = {}
    s.type = GetLootSlotType and GetLootSlotType(i)
    s.link = GetLootSlotLink and GetLootSlotLink(i)
    s.info = try(GetLootSlotInfo, i)
    if GetLootSourceInfo then s.sources = try(GetLootSourceInfo, i) end
    r.slots[i] = s
  end
  sample("loot", r)
end

handlers.QUEST_DETAIL = function(questStartItemID)
  local r = { questStartItemID = questStartItemID }
  r.questID = GetQuestID and GetQuestID()
  r.title = GetTitleText and GetTitleText()
  r.textLen = GetQuestText and #(GetQuestText() or "")
  r.objectiveLen = GetObjectiveText and #(GetObjectiveText() or "")
  if GetRewardText then r.rewardTextLen = #(GetRewardText() or "") end
  r.numRewards = GetNumQuestRewards and GetNumQuestRewards()
  r.numChoices = GetNumQuestChoices and GetNumQuestChoices()
  r.rewardMoney = GetRewardMoney and GetRewardMoney()
  r.rewardXP = GetRewardXP and try(GetRewardXP)[1]
  if r.numRewards and r.numRewards > 0 and GetQuestItemLink then r.reward1 = GetQuestItemLink("reward", 1) end
  r.npcGUID = UnitGUID("npc")
  r.npcName = UnitName("npc")
  r.questitemGUID = UnitGUID("questnpc")
  sample("questDetail", r)
end
handlers.QUEST_PROGRESS = function()
  sample("questProgress", {
    questID = GetQuestID and GetQuestID(),
    progressLen = GetProgressText and #(GetProgressText() or ""),
    numItems = GetNumQuestItems and GetNumQuestItems(),
    moneyToGet = GetQuestMoneyToGet and GetQuestMoneyToGet(),
    completable = IsQuestCompletable and IsQuestCompletable(),
  })
end
handlers.QUEST_COMPLETE = function()
  sample("questComplete", {
    questID = GetQuestID and GetQuestID(),
    rewardTextLen = GetRewardText and #(GetRewardText() or ""),
    numRewards = GetNumQuestRewards and GetNumQuestRewards(),
    numChoices = GetNumQuestChoices and GetNumQuestChoices(),
    money = GetRewardMoney and GetRewardMoney(),
    xp = GetRewardXP and try(GetRewardXP)[1],
    npcGUID = UnitGUID("npc"),
  })
end
handlers.QUEST_GREETING = function()
  local r = { npcGUID = UnitGUID("npc"), available = {}, active = {} }
  local na = GetNumAvailableQuests and GetNumAvailableQuests() or 0
  for i = 1, math.min(na, 4) do
    r.available[i] = { title = GetAvailableTitle and GetAvailableTitle(i), info = GetAvailableQuestInfo and try(GetAvailableQuestInfo, i) }
  end
  local nc = GetNumActiveQuests and GetNumActiveQuests() or 0
  for i = 1, math.min(nc, 4) do
    r.active[i] = { title = GetActiveTitle and GetActiveTitle(i), id = GetActiveQuestID and try(GetActiveQuestID, i)[1] }
  end
  sample("questGreeting", r)
end
handlers.QUEST_ACCEPTED = function(...)
  local r = { args = { ... } }
  local qid = select(2, ...) or select(1, ...)
  if C_QuestLog and C_QuestLog.GetQuestInfo and type(qid) == "number" then r.cInfo = try(C_QuestLog.GetQuestInfo, qid) end
  if C_QuestLog and C_QuestLog.GetQuestObjectives and type(qid) == "number" then r.cObjectives = try(C_QuestLog.GetQuestObjectives, qid) end
  sample("questAccepted", r)
end
handlers.QUEST_TURNED_IN = function(...) sample("questTurnedIn", { args = { ... } }) end
handlers.QUEST_REMOVED = function(...) sample("questRemoved", { args = { ... } }) end

handlers.GOSSIP_SHOW = function()
  local r = { npcGUID = UnitGUID("npc"), npcName = UnitName("npc") }
  if C_GossipInfo then
    if C_GossipInfo.GetText then r.textLen = #(C_GossipInfo.GetText() or "") end
    if C_GossipInfo.GetOptions then
      local opts = try(C_GossipInfo.GetOptions)[1]
      r.numOptions = type(opts) == "table" and #opts or opts
      if type(opts) == "table" and opts[1] then r.option1 = opts[1] end
    end
    if C_GossipInfo.GetAvailableQuests then
      local q = try(C_GossipInfo.GetAvailableQuests)[1]
      r.numAvailable = type(q) == "table" and #q or q
      if type(q) == "table" and q[1] then r.available1 = q[1] end
    end
    if C_GossipInfo.GetActiveQuests then
      local q = try(C_GossipInfo.GetActiveQuests)[1]
      r.numActive = type(q) == "table" and #q or q
      if type(q) == "table" and q[1] then r.active1 = q[1] end
    end
  elseif GetGossipText then
    r.legacyTextLen = #(GetGossipText() or "")
    r.legacyOptions = try(GetGossipOptions)
  end
  sample("gossip", r)
end

handlers.MERCHANT_SHOW = function()
  local r = { npcGUID = UnitGUID("npc"), n = GetMerchantNumItems and GetMerchantNumItems() }
  if CanMerchantRepair then r.repair = CanMerchantRepair() end
  if (r.n or 0) > 0 then
    r.item1 = try(GetMerchantItemInfo, 1)
    r.link1 = GetMerchantItemLink and GetMerchantItemLink(1)
    if GetMerchantItemCostInfo then r.cost1 = try(GetMerchantItemCostInfo, 1) end
  end
  sample("merchant", r)
end
handlers.TRAINER_SHOW = function()
  local r = { npcGUID = UnitGUID("npc"), n = GetNumTrainerServices and GetNumTrainerServices() }
  if GetTrainerServiceTypeFilter then
    r.filters = { available = GetTrainerServiceTypeFilter("available"), unavailable = GetTrainerServiceTypeFilter("unavailable"), used = GetTrainerServiceTypeFilter("used") }
  end
  if (r.n or 0) > 0 then
    r.service1 = try(GetTrainerServiceInfo, 1)
    r.cost1 = GetTrainerServiceCost and try(GetTrainerServiceCost, 1)
    r.link1 = GetTrainerServiceItemLink and try(GetTrainerServiceItemLink, 1)
    r.levelReq1 = GetTrainerServiceLevelReq and try(GetTrainerServiceLevelReq, 1)
    r.skillReq1 = GetTrainerServiceSkillReq and try(GetTrainerServiceSkillReq, 1)
  end
  sample("trainer", r)
end
handlers.TAXIMAP_OPENED = function(...)
  local r = { args = { ... }, npcGUID = UnitGUID("npc") }
  if NumTaxiNodes then
    r.n = NumTaxiNodes()
    r.nodes = {}
    for i = 1, math.min(r.n or 0, 4) do
      r.nodes[i] = {
        name = TaxiNodeName(i),
        type = TaxiNodeGetType and TaxiNodeGetType(i),
        pos = TaxiNodePosition and try(TaxiNodePosition, i),
        cost = TaxiNodeCost and try(TaxiNodeCost, i),
        routes = GetNumRoutes and try(GetNumRoutes, i),
      }
    end
  end
  if C_TaxiMap and C_TaxiMap.GetAllTaxiNodes then
    local map = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
    local res = try(C_TaxiMap.GetAllTaxiNodes, map)
    r.cNodes = res.err or (type(res[1]) == "table" and #res[1]) or "?"
    if type(res[1]) == "table" and res[1][1] then r.cNode1 = res[1][1] end
  end
  sample("taxi", r)
end
handlers.ITEM_TEXT_READY = function()
  sample("itemText", {
    item = ItemTextGetItem and ItemTextGetItem(),
    creator = ItemTextGetCreator and ItemTextGetCreator(),
    material = ItemTextGetMaterial and ItemTextGetMaterial(),
    page = ItemTextGetPage and ItemTextGetPage(),
    textLen = ItemTextGetText and #(ItemTextGetText() or ""),
    hasNext = ItemTextHasNextPage and ItemTextHasNextPage(),
    mouseoverGUID = UnitGUID("mouseover"),
  })
end

local function speech(kind)
  return function(...)
    local text, sender, lang, chan, target, flags, a7, a8, a9, a10, lineID, guid, a13 = ...
    sample("speech_" .. kind, { nargs = select("#", ...), sender = sender, lang = lang, target = target, flags = flags,
      a7 = a7, a8 = a8, a9 = a9, a10 = a10, lineID = lineID, guid = guid, a13 = a13, text = text,
      mouseoverGUID = UnitGUID("mouseover"), targetGUID = UnitGUID("target") })
  end
end
handlers.CHAT_MSG_MONSTER_SAY = speech("say")
handlers.CHAT_MSG_MONSTER_YELL = speech("yell")
handlers.CHAT_MSG_MONSTER_EMOTE = speech("emote")
handlers.CHAT_MSG_MONSTER_WHISPER = speech("whisper")
handlers.CHAT_MSG_RAID_BOSS_EMOTE = speech("bossemote")
handlers.CHAT_MSG_RAID_BOSS_WHISPER = speech("bosswhisper")

handlers.ENCOUNTER_START = function(...) sample("encounterStart", { args = { ... } }) end
handlers.ENCOUNTER_END = function(...) sample("encounterEnd", { args = { ... } }) end
handlers.BOSS_KILL = function(...) sample("bossKill", { args = { ... } }) end

handlers.COMBAT_LOG_EVENT_UNFILTERED = function()
  if not CombatLogGetCurrentEventInfo then return end
  local ts, sub, hide, srcGUID, srcName, srcFlags, srcRaid, dstGUID, dstName, dstFlags, dstRaid, a12, a13, a14 = CombatLogGetCurrentEventInfo()
  combatCounts[sub] = (combatCounts[sub] or 0) + 1
  if sub == "UNIT_DIED" or sub == "PARTY_KILL" then
    sample("cl_" .. sub, { src = srcGUID, srcName = srcName, dst = dstGUID, dstName = dstName, dstFlags = dstFlags })
  elseif sub == "SPELL_CAST_SUCCESS" and srcGUID and string.find(srcGUID, "^Creature") then
    sample("cl_npcCast", { src = srcGUID, srcName = srcName, spellID = a12, spellName = a13, school = a14 })
  elseif sub == "ENVIRONMENTAL_DAMAGE" then
    sample("cl_env", { dst = dstGUID, envType = a12 })
  end
end

handlers.PLAYER_DEAD = function()
  sample("playerDead", { zone = GetZoneText(), sub = GetSubZoneText(), level = UnitLevel("player"), map = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player") })
end
handlers.UI_INFO_MESSAGE = function(...) sample("uiInfo", { args = { ... } }) end
handlers.UI_ERROR_MESSAGE = function(...) sample("uiError", { args = { ... } }) end

handlers.ZONE_CHANGED_NEW_AREA = function()
  local r = { zone = GetZoneText(), sub = GetSubZoneText(), real = GetRealZoneText(), minimap = GetMinimapZoneText and GetMinimapZoneText() }
  if C_Map and C_Map.GetBestMapForUnit then
    r.mapID = C_Map.GetBestMapForUnit("player")
    if r.mapID and C_Map.GetMapInfo then r.mapInfo = try(C_Map.GetMapInfo, r.mapID) end
    if r.mapID and C_MapExplorationInfo and C_MapExplorationInfo.GetExploredMapTextures then
      local res = try(C_MapExplorationInfo.GetExploredMapTextures, r.mapID)
      r.explored = res.err or (type(res[1]) == "table" and #res[1]) or "nil"
    end
  end
  r.instance = try(GetInstanceInfo)
  sample("zoneNewArea", r)
end
handlers.ZONE_CHANGED = function()
  local r = { zone = GetZoneText(), sub = GetSubZoneText() }
  if C_MapExplorationInfo and C_MapExplorationInfo.GetExploredAreaIDsAtPosition and C_Map and C_Map.GetBestMapForUnit then
    local map = C_Map.GetBestMapForUnit("player")
    local pos = map and C_Map.GetPlayerMapPosition(map, "player")
    if pos then
      r.areaIDs = try(C_MapExplorationInfo.GetExploredAreaIDsAtPosition, map, pos)
      if type(r.areaIDs[1]) == "table" and r.areaIDs[1][1] and C_Map.GetAreaInfo then r.areaName = try(C_Map.GetAreaInfo, r.areaIDs[1][1]) end
    end
  end
  sample("zoneChanged", r)
end
handlers.LEARNED_SPELL_IN_SKILL_LINE = function(...) sample("learnedSpellSkillLine", { args = { ... } }) end
handlers.NEW_RECIPE_LEARNED = function(...) sample("newRecipe", { args = { ... } }) end
handlers.PLAYER_XP_UPDATE = function(...) sample("xpUpdate", { args = { ... }, xp = UnitXP("player"), max = UnitXPMax("player") }) end
handlers.ITEM_PUSH = function(...) sample("itemPush", { args = { ... } }) end
handlers.CHAT_MSG_MONSTER_PARTY = speech("party")
handlers.GOSSIP_CONFIRM = function(...) sample("gossipConfirm", { args = { ... } }) end

handlers.UNIT_AURA = function(unit, info)
  if unit ~= "player" then return end
  local r = { unit = unit, infoType = type(info) }
  if type(info) == "table" then r.info = info end
  if C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then
    r.aura1 = try(C_UnitAuras.GetAuraDataByIndex, "player", 1, "HELPFUL")
  end
  if UnitAura then r.legacy1 = try(UnitAura, "player", 1, "HELPFUL") end
  sample("unitAura", r)
end
handlers.LEARNED_SPELL_IN_TAB = function(...) sample("learnedSpell", { args = { ... } }) end
handlers.UNIT_SPELLCAST_SUCCEEDED = function(unit, castGUID, spellID)
  if unit == "player" then sample("playerCast", { castGUID = castGUID, spellID = spellID }) end
end

handlers.TRADE_SKILL_SHOW = function()
  local r = {}
  if GetNumTradeSkills then
    r.n = GetNumTradeSkills()
    r.line = GetTradeSkillLine and try(GetTradeSkillLine)
    for i = 1, math.min(r.n or 0, 3) do
      local info = try(GetTradeSkillInfo, i)
      if info[2] ~= "header" then
        r.sample = { info = info, link = GetTradeSkillItemLink and GetTradeSkillItemLink(i), recipe = GetTradeSkillRecipeLink and try(GetTradeSkillRecipeLink, i), reagents = GetTradeSkillNumReagents and try(GetTradeSkillNumReagents, i), reagent1 = GetTradeSkillReagentInfo and try(GetTradeSkillReagentInfo, i, 1) }
        break
      end
    end
  end
  if C_TradeSkillUI and C_TradeSkillUI.GetAllRecipeIDs then
    local res = try(C_TradeSkillUI.GetAllRecipeIDs)
    r.cRecipes = res.err or (type(res[1]) == "table" and #res[1]) or "?"
  end
  sample("tradeSkill", r)
end
handlers.CRAFT_SHOW = function()
  local r = { n = GetNumCrafts and GetNumCrafts() }
  if (r.n or 0) > 0 then
    r.craft1 = try(GetCraftInfo, 1)
    r.link1 = GetCraftItemLink and try(GetCraftItemLink, 1)
    r.reagent1 = GetCraftReagentInfo and try(GetCraftReagentInfo, 1, 1)
    r.line = GetCraftDisplaySkillLine and try(GetCraftDisplaySkillLine)
  end
  sample("craft", r)
end
handlers.CHAT_MSG_COMBAT_FACTION_CHANGE = function(text) sample("factionChange", { text = text }) end
handlers.CHAT_MSG_SKILL = function(text) sample("skillMsg", { text = text }) end
handlers.CHAT_MSG_LOOT = function(...)
  local n = select("#", ...)
  local r = { nargs = n, text = (...) }
  for i = 2, n do r["a" .. i] = select(i, ...) end
  sample("lootMsg", r)
end
handlers.CHAT_MSG_MONEY = function(text) sample("moneyMsg", { text = text }) end
handlers.CHAT_MSG_COMBAT_HONOR_GAIN = function(text) sample("honorMsg", { text = text }) end
handlers.PLAYER_LEVEL_UP = function(...) sample("levelUp", { args = { ... } }) end
handlers.PLAYER_EQUIPMENT_CHANGED = function(...) sample("equipChanged", { args = { ... } }) end
handlers.TIME_PLAYED_MSG = function(...) sample("timePlayed", { args = { ... } }) end
handlers.INSPECT_READY = function(guid) sample("inspectReady", { guid = guid }) end
handlers.MAIL_INBOX_UPDATE = function()
  local r = { n = GetInboxNumItems and try(GetInboxNumItems) }
  if GetInboxHeaderInfo and GetInboxNumItems and (GetInboxNumItems() or 0) > 0 then r.header1 = try(GetInboxHeaderInfo, 1) end
  sample("mailInbox", r)
end
handlers.DUEL_FINISHED = function(...) sample("duelFinished", { args = { ... } }) end
handlers.UPDATE_BATTLEFIELD_STATUS = function(...) sample("bfStatus", { args = { ... }, status = GetBattlefieldStatus and try(GetBattlefieldStatus, ...) }) end
handlers.PVP_MATCH_COMPLETE = function(...) sample("pvpMatchComplete", { args = { ... }, winner = GetBattlefieldWinner and try(GetBattlefieldWinner) }) end
handlers.GROUP_ROSTER_UPDATE = function() sample("groupRoster", { n = GetNumGroupMembers and GetNumGroupMembers(), raid = IsInRaid and IsInRaid() }) end
handlers.PLAYER_INTERACTION_MANAGER_FRAME_SHOW = function(...) sample("interactionShow", { args = { ... } }) end
handlers.ACHIEVEMENT_EARNED = function(...) sample("achievementEarned", { args = { ... } }) end
handlers.HARDCORE_DEATH = function(...) sample("hardcoreDeath", { args = { ... } }) end
handlers.CHAT_MSG_SYSTEM = function(text)
  -- only keep discovery-like and level-like system lines
  if text and (string.find(text, "iscover") or string.find(text, "learned") or string.find(text, "xperience")) then sample("systemMsg", { text = text }) end
end

local COUNT_ONLY = { QUEST_LOG_UPDATE = true, BAG_UPDATE = true, PLAYER_MONEY = true, GET_ITEM_INFO_RECEIVED = true,
  ITEM_DATA_LOAD_RESULT = true, SPELLS_CHANGED = true, UPDATE_FACTION = true, SKILL_LINES_CHANGED = true,
  MERCHANT_UPDATE = true, TRAINER_UPDATE = true, TRADE_SKILL_UPDATE = true, CRAFT_UPDATE = true,
  KNOWN_TITLES_UPDATE = true, AREA_POIS_UPDATED = true, UNIT_QUEST_LOG_CHANGED = true, PLAYER_FLAGS_CHANGED = true,
  UNIT_FACTION = true, QUEST_DATA_LOAD_RESULT = true, LOOT_CLOSED = true, LOOT_SLOT_CLEARED = true,
  GOSSIP_CLOSED = true, QUEST_FINISHED = true, TAXIMAP_CLOSED = true, ITEM_TEXT_BEGIN = true,
  PLAYER_ALIVE = true, PLAYER_UNGHOST = true, ZONE_CHANGED_INDOORS = true, PLAYER_CONTROL_LOST = true,
  PLAYER_CONTROL_GAINED = true, CINEMATIC_START = true, PLAYER_INTERACTION_MANAGER_FRAME_HIDE = true,
  BANKFRAME_OPENED = true, AUCTION_HOUSE_SHOW = true, PET_STABLE_SHOW = true, CONFIRM_XP_LOSS = true,
  RESURRECT_REQUEST = true, CORPSE_IN_RANGE = true, MAIL_SHOW = true, PLAYER_PVP_KILLS_CHANGED = true,
  UPDATE_BATTLEFIELD_SCORE = true, DUEL_REQUESTED = true, CRITERIA_UPDATE = true, SEASON_INFO_UPDATE = true,
  PLAYER_ENTERING_WORLD = true, PLAYER_REGEN_DISABLED = true, PLAYER_REGEN_ENABLED = true,
  QUEST_WATCH_UPDATE = true, QUEST_ITEM_UPDATE = true, TRADE_SKILL_LIST_UPDATE = true,
  UNIT_INVENTORY_CHANGED = true, CHAT_MSG_TEXT_EMOTE = true, PLAYER_UPDATE_RESTING = true,
  DISCOVERY_PLAYER_SHOW = true }

frame:SetScript("OnEvent", function(self, event, ...)
  if event == "PLAYER_LOGIN" then
    WoWCompendiumProbeDB = WoWCompendiumProbeDB or {}
    if WoWCompendiumProbeDB.version ~= PROBE_VERSION then wipe(WoWCompendiumProbeDB) end
    DB = WoWCompendiumProbeDB
    DB.version = PROBE_VERSION
    DB.counts = DB.counts or {}
    DB.samples = DB.samples or {}
    DB.notes = DB.notes or {}
    DB.sessions = (DB.sessions or 0) + 1
    registerAll()
    probeAPIs()
    probeValues()
    -- delay the snapshot so caches warm up
    if C_Timer and C_Timer.After then
      C_Timer.After(3, probeLogin)
    else
      probeLogin()
    end
    if RequestTimePlayed then pcall(RequestTimePlayed) end
    print("|cff66ccffWoW Compendium Probe|r loaded. Play normally, then type /reload or log out. /cprobe shows a summary.")
    return
  end
  if not DB then return end
  if event == "PLAYER_LOGOUT" then
    DB.combatCounts = combatCounts
    DB.logoutAt = now()
    return
  end
  local h = handlers[event]
  if h then
    local ok, err = pcall(h, ...)
    if not ok then
      DB.handlerErrors = DB.handlerErrors or {}
      DB.handlerErrors[event] = tostring(err)
    end
  elseif COUNT_ONLY[event] then
    DB.counts[event] = (DB.counts[event] or 0) + 1
  else
    DB.counts["?" .. event] = (DB.counts["?" .. event] or 0) + 1
  end
end)

-- Only PLAYER_LOGIN is registered at file load. SavedVariables are not available
-- until then, so everything else is registered inside the PLAYER_LOGIN handler.
frame:RegisterEvent("PLAYER_LOGIN")

SLASH_CPROBE1 = "/cprobe"
SlashCmdList.CPROBE = function(msg)
  if msg == "reset" then
    wipe(WoWCompendiumProbeDB)
    print("WoW Compendium Probe: data cleared. /reload to start fresh.")
    return
  end
  if msg == "tip" and UnitExists("target") then
    local r = scanTip("SetUnit", "target")
    print("WoW Compendium Probe: tooltip lines for target: " .. tostring(r.n or r.err))
    for i, l in ipairs(r.lines or {}) do print("  " .. i .. ": " .. tostring(l)) end
    return
  end
  local n = 0
  for _ in pairs(DB.counts or {}) do n = n + 1 end
  local unknown = 0
  for _, v in pairs(DB.events or {}) do if v == "unknown" then unknown = unknown + 1 end end
  print(string.format("WoW Compendium Probe: %d event kinds seen, %d unknown events, login snapshot %s. /reload to save.",
    n, unknown, DB.login and "done" or "pending"))
end
