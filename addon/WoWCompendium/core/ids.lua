-- GUID parsing and identity generation.
local _, NS = ...
local ids = {}
NS.ids = ids

-- Creature-0-<server>-<instance>-<zoneUid>-<npcID>-<spawnUid>
function ids.parse(guid)
  if type(guid) ~= "string" then return nil end
  local kind, server, inst, zone, id, spawn = string.match(guid, "^(%a+)%-0%-(%d+)%-(%d+)%-(%d+)%-(%d+)%-(%x+)$")
  if kind then
    return { kind = kind, server = tonumber(server), instance = tonumber(inst), zoneUid = tonumber(zone), id = tonumber(id), spawn = spawn }
  end
  local realm, uid = string.match(guid, "^Player%-(%d+)%-(%x+)$")
  if realm then return { kind = "Player", realm = tonumber(realm), uid = uid } end
  local irealm, iuid = string.match(guid, "^Item%-(%d+)%-0%-(%x+)$")
  if irealm then return { kind = "Item", realm = tonumber(irealm), uid = iuid } end
  return nil
end

-- Item link or item string -> itemID, random suffix ID (0 when none), and the
-- bare "item:..." string. Links look like |cff1eff00|Hitem:2589:0:0:0:0:0:0:0:60|h[Linen Cloth]|h|r.
function ids.itemLink(link)
  if type(link) ~= "string" then return nil end
  local str = string.match(link, "|H(item:[^|]+)|h") or string.match(link, "^(item:[%d:%-]+)")
  if not str then return nil end
  local id, suffix = string.match(str, "^item:(%d+):%d*:%d*:%d*:%d*:%d*:(%-?%d*)")
  id = tonumber(id or string.match(str, "^item:(%d+)"))
  if not id then return nil end
  return id, tonumber(suffix) or 0, str
end

-- World units only. "Pet" GUIDs are player-owned and never wiki data (D-0038).
function ids.isCreature(parsed)
  return parsed and (parsed.kind == "Creature" or parsed.kind == "Vehicle")
end

-- Random UUID v4. The client seeds math.random itself and does not expose
-- math.randomseed (N-0014), so never call it unguarded.
function ids.uuid()
  if math.randomseed then
    local seed = (NS.now() or 0) + math.floor((GetTime and GetTime() or 0) * 1000)
    pcall(math.randomseed, seed % 2147483647)
  end
  local template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  return (string.gsub(template, "[xy]", function(c)
    local v = (c == "x") and math.random(0, 15) or math.random(8, 11)
    return string.format("%x", v)
  end))
end
