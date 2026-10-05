-- Quests: the quest windows (detail, progress, complete), the quest log, and
-- the character's completed set (docs/03 "Quests"). Quest text is recorded as
-- the game shows it; who gives and who takes a quest comes from the questnpc
-- unit (N-0003). Journal: accept, complete and abandon events.
local _, NS = ...
local store, ids, compat, throttle = NS.store, NS.ids, NS.compat, NS.throttle

local turnedIn = {}   -- questID -> true this session (so QUEST_REMOVED means abandon otherwise)
local titles = {}     -- questID -> title, for events

NS.on("PLAYER_LOGIN", function()
  turnedIn = {}
  titles = {}
end)

-- The creature behind the open quest window, or nil (item-started quests have an Item GUID).
local function source()
  local guid = UnitGUID and UnitGUID("questnpc")
  local p = ids.parse(guid)
  if ids.isCreature(p) then return { k = "c", id = p.id } end
  if p and p.kind == "Item" then return { k = "i" } end
  return nil
end

local function items(kind, count)
  local out = {}
  for i = 1, count or 0 do
    local link = GetQuestItemLink and GetQuestItemLink(kind, i)
    local id = link and ids.itemLink(link)
    if id then
      local entry = { i = id }
      if GetQuestItemInfo then
        local _, _, num = GetQuestItemInfo(kind, i)
        if num and num > 1 then entry.n = num end
      end
      out[#out + 1] = entry
      if NS.items then NS.items.see(link) end
    end
  end
  return out
end

local function rewards(rec)
  local rw = items("reward", GetNumQuestRewards and GetNumQuestRewards())
  if #rw > 0 then rec.rw = rw end
  local ch = items("choice", GetNumQuestChoices and GetNumQuestChoices())
  if #ch > 0 then rec.ch = ch end
  local money = GetRewardMoney and GetRewardMoney()
  if money and money > 0 then rec.money = money end
  local xp = GetRewardXP and GetRewardXP()
  if xp and xp > 0 then rec.xp = xp end
end

NS.on("QUEST_DETAIL", function()
  local id = GetQuestID and GetQuestID()
  if not id or id == 0 then return end
  local rec = store.quest(id)
  if not rec then return end
  rec.title = (GetTitleText and GetTitleText()) or rec.title
  titles[id] = rec.title
  local text = GetQuestText and GetQuestText()
  if text and text ~= "" then rec.desc = text end
  local obj = GetObjectiveText and GetObjectiveText()
  if obj and obj ~= "" then rec.obj = obj end
  rewards(rec)
  local src = source()
  if src then
    rec.giver = src
    if src.k == "c" then store.addPos(rec, store.pos("interact")) end
  end
end)

NS.on("QUEST_PROGRESS", function()
  local id = GetQuestID and GetQuestID()
  if not id or id == 0 then return end
  local rec = store.quest(id)
  if not rec then return end
  rec.title = (GetTitleText and GetTitleText()) or rec.title
  local text = GetProgressText and GetProgressText()
  if text and text ~= "" then rec.prog = text end
  local req = items("required", GetNumQuestItems and GetNumQuestItems())
  if #req > 0 then rec.req = req end
  local money = GetQuestMoneyToGet and GetQuestMoneyToGet()
  if money and money > 0 then rec.reqMoney = money end
  local src = source()
  if src then rec.ender = src end
end)

NS.on("QUEST_COMPLETE", function()
  local id = GetQuestID and GetQuestID()
  if not id or id == 0 then return end
  local rec = store.quest(id)
  if not rec then return end
  rec.title = (GetTitleText and GetTitleText()) or rec.title
  local text = GetRewardText and GetRewardText()
  if text and text ~= "" then rec.done = text end
  rewards(rec)
  local src = source()
  if src then rec.ender = src end
end)

-- Quest log: level, header, structured objectives, log rewards.
local function scanLog()
  if not (GetNumQuestLogEntries and GetQuestLogTitle) then return end
  local n = GetNumQuestLogEntries() or 0
  local selected = GetQuestLogSelection and GetQuestLogSelection()
  local header
  for i = 1, n do
    local title, level, group, isHeader, _, _, frequency, questID = GetQuestLogTitle(i)
    if isHeader then
      header = title
    elseif questID and questID ~= 0 then
      local rec = store.quest(questID)
      if rec then
        rec.title = title or rec.title
        titles[questID] = rec.title
        if level and level > 0 then rec.lvl = level end
        if group and group > 0 then rec.grp = group end
        if header then rec.hdr = header end
        if frequency and frequency > 1 then rec.freq = frequency end
        if C_QuestLog and C_QuestLog.GetQuestObjectives then
          local ok, objs = pcall(C_QuestLog.GetQuestObjectives, questID)
          if ok and type(objs) == "table" and #objs > 0 then
            local list = {}
            for _, o in ipairs(objs) do
              local entry = { t = o.text or "" }
              if o.type then entry.type = o.type end
              if o.numRequired and o.numRequired > 0 then entry.n = o.numRequired end
              list[#list + 1] = entry
            end
            rec.objs = list
          end
        end
        if SelectQuestLogEntry and GetQuestLogQuestText then
          SelectQuestLogEntry(i)
          local desc, obj = GetQuestLogQuestText()
          if desc and desc ~= "" and not rec.desc then rec.desc = desc end
          if obj and obj ~= "" and not rec.obj then rec.obj = obj end
          local money = GetQuestLogRewardMoney and GetQuestLogRewardMoney()
          if money and money > 0 and not rec.money then rec.money = money end
          local xp = GetQuestLogRewardXP and GetQuestLogRewardXP()
          if xp and xp > 0 and not rec.xp then rec.xp = xp end
        end
      end
    end
  end
  if selected and SelectQuestLogEntry then SelectQuestLogEntry(selected) end
end

NS.on("QUEST_LOG_UPDATE", function()
  if throttle.allow("questlog", 30) then scanLog() end
end)

-- Completed set: Journal state and existence evidence.
local function readCompleted()
  local list
  if GetQuestsCompleted then
    list = GetQuestsCompleted()
  elseif C_QuestLog and C_QuestLog.GetAllCompletedQuestIDs then
    local arr = C_QuestLog.GetAllCompletedQuestIDs()
    list = {}
    for _, id in ipairs(arr or {}) do list[id] = true end
  end
  if type(list) ~= "table" then return end
  local state = store.state()
  if not state then return end
  local out = {}
  for id in pairs(list) do out[#out + 1] = id end
  table.sort(out)
  state.quests = out
end

NS.on("PLAYER_ENTERING_WORLD", function()
  C_Timer.After(10, function()
    readCompleted()
    scanLog()
  end)
end)

NS.on("QUEST_ACCEPTED", function(a, b)
  local id = b or a
  if type(id) ~= "number" or id == 0 then return end
  store.event("quest_accept", { id = id, title = titles[id] }, true)
  C_Timer.After(1, function() if throttle.allow("questlog", 5) then scanLog() end end)
end)

NS.on("QUEST_TURNED_IN", function(id, xp, money)
  if type(id) ~= "number" then return end
  turnedIn[id] = true
  local rec = store.quest(id)
  if rec then
    if xp and xp > 0 then rec.xp = xp end
    if money and money > 0 then rec.money = money end
  end
  local d = { id = id, title = titles[id] }
  if xp and xp > 0 then d.xp = xp end
  if money and money > 0 then d.money = money end
  store.event("quest_complete", d, true)
  local state = store.state()
  if state then
    state.quests = state.quests or {}
    state.quests[#state.quests + 1] = id
  end
end)

NS.on("QUEST_REMOVED", function(id)
  if type(id) ~= "number" or turnedIn[id] then return end
  store.event("quest_abandon", { id = id, title = titles[id] }, true)
end)
