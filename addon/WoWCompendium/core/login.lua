-- The single in-game output: one chat line at login, only when there is
-- something to say (docs/03, D-0017, D-0028).
local _, NS = ...

local SITE = "wow-wiki.netlify.app"

local function say(msg)
  print("|cff66ccffWoW Compendium:|r " .. msg)
end

NS.on("PLAYER_LOGIN", function()
  if not (NS.db and NS.char) then return end
  local guid = UnitGUID("player")
  local pending = NS.session_api.unacked(NS.char, guid)
  if not NS.link.isLinked() then
    say("Not linked to an account. Open " .. SITE .. " to link.")
  elseif pending > 0 then
    say(string.format("%d session%s not yet synced. Open %s to sync, or install the sync helper to do it automatically.",
      pending, pending == 1 and "" or "s", SITE))
  end
end)
