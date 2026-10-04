-- Session lifecycle: one session per login, sequence numbers per character,
-- context stamp, logout finalization, and the size guard.
local _, NS = ...
local session = {}
NS.session_api = session

local MAX_SESSIONS_WITH_WORLD = 60

local function characterMeta(guid)
  local name = UnitName("player")
  local _, classFile, classId = UnitClass("player")
  local raceName, raceFile, raceId = UnitRace("player")
  local faction = UnitFactionGroup("player")
  local meta = {
    guid = guid,
    name = name,
    realm = GetRealmName(),
    flavor = NS.flavor(),
    class = classFile,
    classId = classId,
    race = raceFile or raceName,
    raceId = raceId,
    faction = faction,
  }
  if GetNormalizedRealmName then meta.realmNormalized = GetNormalizedRealmName() end
  if GetRealmID then meta.realmId = GetRealmID() end
  if GetCurrentRegion then meta.region = GetCurrentRegion() end
  if UnitSex then meta.sex = UnitSex("player") end
  return meta
end

local function context()
  local version, build, _, interface = GetBuildInfo()
  local ctx = {
    flavor = NS.flavor(),
    project = WOW_PROJECT_ID or 0,
    version = version,
    build = tonumber(build) or 0,
    interface = interface,
    locale = GetLocale(),
    realm = GetRealmName(),
    addon = NS.version(),
    started = NS.now(),
    levelStart = UnitLevel("player"),
    hardcore = NS.compat.isHardcore(),
  }
  if GetCurrentRegion then ctx.region = GetCurrentRegion() end
  if GetCurrentRegionName then ctx.regionName = GetCurrentRegionName() end
  if GetNormalizedRealmName then ctx.realmNormalized = GetNormalizedRealmName() end
  if GetRealmID then ctx.realmId = GetRealmID() end
  local season = NS.compat.activeSeason()
  if season then ctx.season = season end
  local connected = NS.compat.connectedRealms()
  if connected then ctx.connectedRealms = connected end
  return ctx
end

-- Drop sessions the server has acknowledged (docs/04).
function session.applyAck(char, guid)
  local ack = NS.db.ack and NS.db.ack[guid]
  if not ack then return 0 end
  local removed = 0
  for key, s in pairs(char.sessions) do
    if s.seq and s.seq <= ack then
      char.sessions[key] = nil
      removed = removed + 1
    end
  end
  return removed
end

-- Keep the file bounded: beyond MAX_SESSIONS_WITH_WORLD unacked sessions, the
-- oldest lose their world data and keep only Journal events and state.
function session.sizeGuard(char)
  local seqs = {}
  for _, s in pairs(char.sessions) do seqs[#seqs + 1] = s.seq end
  table.sort(seqs)
  local excess = #seqs - MAX_SESSIONS_WITH_WORLD
  local stripped = 0
  for i = 1, math.max(0, excess) do
    local s = char.sessions[tostring(seqs[i])]
    if s and s.world then
      s.world = nil
      s.worldStripped = true
      stripped = stripped + 1
    end
  end
  return stripped
end

function session.unacked(char, guid)
  local ack = (NS.db.ack and NS.db.ack[guid]) or 0
  local n = 0
  for _, s in pairs(char.sessions) do
    if s.seq > ack and s.ctx and s.ctx.ended then n = n + 1 end
  end
  return n
end

function session.begin()
  local db = NS.db
  if not db then return nil end
  local guid = UnitGUID("player")
  if not guid then return nil end
  local char = db.characters[guid]
  if not char then
    char = { meta = characterMeta(guid), nextSeq = 1, sessions = {} }
    db.characters[guid] = char
  else
    char.meta = characterMeta(guid)
    char.sessions = char.sessions or {}
  end
  NS.char = char
  NS.ack.apply(guid)
  session.applyAck(char, guid)
  session.sizeGuard(char)
  local seq = char.nextSeq
  char.nextSeq = seq + 1
  local s = { seq = seq, ctx = context(), world = {}, events = {}, state = {} }
  char.sessions[tostring(seq)] = s
  NS.session = s
  return s
end

function session.finish()
  local s = NS.session
  if not s then return end
  s.ctx.ended = NS.now()
  s.ctx.levelEnd = UnitLevel("player")
end

NS.on("PLAYER_LOGIN", function()
  if not NS.db then NS.initDb() end
  NS.link.apply()
  session.begin()
  NS.store.event("login", { level = UnitLevel("player") }, true)
end)

NS.on("PLAYER_ENTERING_WORLD", function(isLogin, isReload)
  if NS.session and isReload then NS.session.ctx.reload = true end
end)

NS.on("PLAYER_LOGOUT", function()
  if NS.session then
    NS.store.event("logout", { level = UnitLevel("player") }, true)
    session.finish()
  end
end)
