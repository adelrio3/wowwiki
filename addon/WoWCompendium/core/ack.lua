-- Reads the ack file written by the site or helper (docs/04) into the
-- SavedVariables so pruning is driven by server-confirmed sequence numbers.
local _, NS = ...
local ack = {}
NS.ack = ack

function ack.apply(guid)
  local db = NS.db
  if not db then return end
  db.ack = db.ack or {}
  local src = COMPENDIUM_ACK
  if type(src) ~= "table" then return end
  for g, seq in pairs(src) do
    local n = tonumber(seq)
    if type(g) == "string" and n and n > (db.ack[g] or 0) then
      db.ack[g] = n
    end
  end
end
