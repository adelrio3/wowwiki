-- WoW Compendium add-on: namespace, flavor detection, SavedVariables bootstrap,
-- event bus. Everything else hangs off NS.
local ADDON, NS = ...
_G.WoWCompendium = NS

NS.name = ADDON
NS.schema = 1

-- Resolved at ADDON_LOADED; nil before.
NS.db = nil
NS.char = nil      -- current character's record in db
NS.session = nil   -- current session record

NS.handlers = {}
NS.frame = CreateFrame("Frame")

-- Register a handler for an event. Unknown events (per flavor) are recorded,
-- never fatal. Several handlers per event are allowed.
function NS.on(event, fn)
  local list = NS.handlers[event]
  if not list then
    list = {}
    NS.handlers[event] = list
    local ok = pcall(NS.frame.RegisterEvent, NS.frame, event)
    if not ok then
      NS.unknownEvents = NS.unknownEvents or {}
      NS.unknownEvents[event] = true
    end
  end
  list[#list + 1] = fn
end

NS.frame:SetScript("OnEvent", function(_, event, ...)
  local list = NS.handlers[event]
  if not list then return end
  for i = 1, #list do
    local ok, err = pcall(list[i], ...)
    if not ok and NS.db then
      NS.db.errors = NS.db.errors or {}
      local key = event
      NS.db.errors[key] = tostring(err)
    end
  end
end)

function NS.now()
  if GetServerTime then return GetServerTime() end
  return time()
end

function NS.version()
  if C_AddOns and C_AddOns.GetAddOnMetadata then
    return C_AddOns.GetAddOnMetadata(ADDON, "Version") or "0.0.0"
  elseif GetAddOnMetadata then
    return GetAddOnMetadata(ADDON, "Version") or "0.0.0"
  end
  return "0.0.0"
end

function NS.tocVariant()
  if C_AddOns and C_AddOns.GetAddOnMetadata then
    return C_AddOns.GetAddOnMetadata(ADDON, "X-Toc")
  elseif GetAddOnMetadata then
    return GetAddOnMetadata(ADDON, "X-Toc")
  end
end

-- Flavor from WOW_PROJECT_ID, with the TOC variant as a tie breaker. Values
-- verified: era = 2 (docs/03). Others per packages/game-meta.
function NS.flavor()
  local toc = NS.tocVariant()
  if toc == "Forever" then return "forever" end
  if toc == "TBC" then return "anniversary" end
  local id = WOW_PROJECT_ID
  if id == 2 then return "era" end
  if id == 1 then return "retail" end
  if id == 5 then return "anniversary" end
  if id == 14 or id == 19 then return "mists" end
  if toc == "Mainline" then return "retail" end
  if toc == "Mists" then return "mists" end
  return "era"
end

-- SavedVariables bootstrap. Runs at ADDON_LOADED for this add-on only.
function NS.initDb()
  WoWCompendiumDB = WoWCompendiumDB or {}
  local db = WoWCompendiumDB
  if db.schema ~= NS.schema then
    -- A future version will migrate; for now a different schema is wiped
    -- after being preserved for one upload cycle by the site's parser.
    for k in pairs(db) do db[k] = nil end
    db.schema = NS.schema
  end
  db.addonVersion = NS.version()
  db.identity = db.identity or NS.ids.uuid()
  db.characters = db.characters or {}
  db.ack = db.ack or {}
  NS.db = db
  return db
end

NS.on("ADDON_LOADED", function(name)
  if name ~= ADDON then return end
  NS.initDb()
end)
