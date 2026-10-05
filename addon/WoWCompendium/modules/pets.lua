-- Hunter pets: the player's own pet and stable, as the client shows them
-- (D-0049). A tamed pet keeps the creature ID of the wild beast it was, so
-- its presence is proof that beast can be tamed; its spellbook shows the
-- skills a pet of that kind can carry. Pets of other players are never read.
local _, NS = ...
local store, ids, compat, throttle = NS.store, NS.ids, NS.compat, NS.throttle

local function readPet()
  if not (UnitExists and UnitExists("pet")) then return end
  local p = ids.parse(UnitGUID("pet"))
  if not p or p.kind ~= "Pet" then return end
  -- UNIT_PET and PET_BAR_UPDATE come in bursts; one read per ten seconds is plenty.
  if not throttle.allow("pet", 10) then return end
  local state = store.state()
  if not state then return end
  local pet = { id = p.id, name = UnitName("pet"), lvl = UnitLevel("pet") }
  local fam = UnitCreatureFamily and UnitCreatureFamily("pet")
  if fam then pet.fam = fam end
  local skills = compat.petSpells()
  if skills and #skills > 0 then pet.sk = skills end
  state.pet = pet
  -- World evidence: this beast can be tamed.
  local w = store.tamed(p.id)
  if w and fam then w.fam = fam end
end

NS.on("UNIT_PET", function(unit)
  if unit == "player" then readPet() end
end)

NS.on("PET_BAR_UPDATE", readPet)

NS.on("PLAYER_ENTERING_WORLD", function()
  C_Timer.After(8, readPet)
end)

NS.on("PET_STABLE_SHOW", function()
  local list = compat.stablePets()
  local state = store.state()
  if list and state then state.stable = list end
end)
