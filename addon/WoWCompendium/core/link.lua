-- Reads the link file written by the site or helper (docs/04).
local _, NS = ...
local link = {}
NS.link = link

function link.apply()
  local db = NS.db
  if not db then return end
  local src = COMPENDIUM_LINK
  if type(src) == "table" and type(src.account_token) == "string" and src.account_token ~= "" then
    db.link = { accountToken = src.account_token, linkedAt = tonumber(src.linked_at) or NS.now() }
  end
end

-- Settings travel in the link file (docs/04). Defaults apply when absent.
function link.setting(name, default)
  local src = COMPENDIUM_LINK
  if type(src) == "table" and type(src.settings) == "table" and src.settings[name] ~= nil then
    return src.settings[name]
  end
  return default
end

function link.isLinked()
  return NS.db and NS.db.link and NS.db.link.accountToken and true or false
end
