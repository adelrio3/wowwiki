-- In-memory journal store backed directly by the SavedVariables tables.
-- Modules call store.creature / store.area / store.event; they never touch
-- WoWCompendiumDB themselves. All ID-keyed maps use string keys (schema v1).
local _, NS = ...
local store = {}
NS.store = store

local MAX_POSITIONS = 20
local MIN_MOVE = 0.01 -- map fraction; ~1% of the map

local function world()
  local s = NS.session
  if not s then return nil end
  s.world = s.world or {}
  return s.world
end

-- Current player position record for an observation.
function store.pos(kind)
  local map, x, y = NS.compat.playerMapPosition()
  local inst, wx, wy = NS.compat.playerWorldPosition()
  local p = { t = NS.now(), k = kind }
  if map then p.m = map end
  if x then p.x = x; p.y = y end
  if inst then p.i = inst; p.wx = wx; p.wy = wy end
  return p
end

local function samePlace(a, b)
  if a.m ~= b.m or a.k ~= b.k then return false end
  if not (a.x and b.x) then return true end
  return math.abs(a.x - b.x) < MIN_MOVE and math.abs(a.y - b.y) < MIN_MOVE
end

-- Append a position unless it duplicates the last one of the same kind, and
-- cap the list.
function store.addPos(rec, pos)
  rec.pos = rec.pos or {}
  local list = rec.pos
  for i = #list, 1, -1 do
    if list[i].k == pos.k then
      if samePlace(list[i], pos) then return false end
      break
    end
  end
  if #list >= MAX_POSITIONS then return false end
  list[#list + 1] = pos
  return true
end

local function bucket(name)
  local w = world()
  if not w then return nil end
  w[name] = w[name] or {}
  return w[name]
end

function store.creature(id)
  local b = bucket("creatures")
  if not b then return nil end
  local key = tostring(id)
  local rec = b[key]
  local t = NS.now()
  if not rec then
    rec = { id = id, n = 0, ft = t, lt = t }
    b[key] = rec
  end
  rec.lt = t
  return rec
end

function store.map(id)
  local b = bucket("maps")
  if not b then return nil end
  local key = tostring(id)
  if not b[key] then b[key] = { id = id, ft = NS.now() } end
  return b[key]
end

function store.area(id)
  local b = bucket("areas")
  if not b then return nil end
  local key = tostring(id)
  local t = NS.now()
  local rec = b[key]
  if not rec then
    rec = { id = id, ft = t, lt = t }
    b[key] = rec
  end
  rec.lt = t
  return rec
end

function store.zoneText(zone, sub)
  local b = bucket("zoneTexts")
  if not b then return nil end
  local key = zone .. "/" .. (sub or "")
  local t = NS.now()
  local rec = b[key]
  if not rec then
    rec = { zone = zone, ft = t, lt = t }
    if sub and sub ~= "" then rec.sub = sub end
    b[key] = rec
  end
  rec.lt = t
  return rec
end

function store.instance(id)
  local b = bucket("instances")
  if not b then return nil end
  local key = tostring(id)
  if not b[key] then b[key] = { id = id, ft = NS.now() } end
  return b[key]
end

function store.taxiNode(id)
  local b = bucket("taxiNodes")
  if not b then return nil end
  local key = tostring(id)
  if not b[key] then b[key] = { id = id, ft = NS.now() } end
  return b[key]
end

-- Journal event. `withPos` attaches the player's position.
function store.event(kind, data, withPos)
  local s = NS.session
  if not s then return nil end
  s.events = s.events or {}
  local ev = { t = NS.now(), k = kind }
  if data then ev.d = data end
  if withPos then
    local p = store.pos("player")
    ev.m = p.m; ev.x = p.x; ev.y = p.y; ev.i = p.i; ev.wx = p.wx; ev.wy = p.wy
  end
  s.events[#s.events + 1] = ev
  return ev
end

function store.state()
  local s = NS.session
  if not s then return nil end
  s.state = s.state or {}
  return s.state
end

-- Mark an explored area id in the session state (set semantics, array form).
function store.explored(areaID)
  local st = store.state()
  if not st then return end
  st.explored = st.explored or {}
  for i = 1, #st.explored do
    if st.explored[i] == areaID then return false end
  end
  st.explored[#st.explored + 1] = areaID
  return true
end
