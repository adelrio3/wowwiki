-- Rate limiting helpers. Nothing in the add-on runs on every frame.
local _, NS = ...
local throttle = {}
NS.throttle = throttle

local last = {}

-- Returns true at most once per `seconds` for the given key.
function throttle.allow(key, seconds)
  local t = GetTime and GetTime() or NS.now()
  local prev = last[key]
  if prev and (t - prev) < seconds then return false end
  last[key] = t
  return true
end

-- Coalesce bursts: call fn once, `delay` seconds after the last trigger.
local pending = {}
function throttle.debounce(key, delay, fn)
  pending[key] = fn
  if not (C_Timer and C_Timer.After) then fn() pending[key] = nil return end
  local token = {}
  last["debounce:" .. key] = token
  C_Timer.After(delay, function()
    if last["debounce:" .. key] == token and pending[key] then
      local f = pending[key]
      pending[key] = nil
      f()
    end
  end)
end
