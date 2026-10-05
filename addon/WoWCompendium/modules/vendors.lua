-- Vendors: what each merchant sells, at what price, and whether stock is
-- limited (docs/03 "Vendors"). The merchant APIs index every item across the
-- frame's pages, so one scan covers the whole list.
local _, NS = ...
local store, ids, compat, throttle = NS.store, NS.ids, NS.compat, NS.throttle

local function scan()
  local p = ids.parse(UnitGUID and UnitGUID("npc"))
  if not ids.isCreature(p) then return end
  -- MERCHANT_UPDATE fires on every page turn and purchase; a few seconds apart is plenty.
  if not throttle.allow("vendor:" .. p.id, 5) then return end
  local rec = store.vendor(p.id)
  if not rec then return end
  if CanMerchantRepair and CanMerchantRepair() then rec.rep = true end
  local n = (GetMerchantNumItems and GetMerchantNumItems()) or 0
  for i = 1, n do
    local link = GetMerchantItemLink and GetMerchantItemLink(i)
    local id = link and ids.itemLink(link)
    if id then
      local _, price, stack, avail, extended = compat.merchantItem(i)
      local it = { p = price, st = stack }
      if avail and avail >= 0 then it.lim = avail end
      if extended and GetMerchantItemCostInfo then
        local count = GetMerchantItemCostInfo(i) or 0
        local ec = {}
        for j = 1, count do
          local _, value, clink, cname = GetMerchantItemCostItem(i, j)
          local cid = clink and ids.itemLink(clink)
          local cost = { n = value }
          if cid then cost.i = cid else cost.name = cname end
          ec[#ec + 1] = cost
        end
        if #ec > 0 then it.ec = ec end
      end
      rec.items[tostring(id)] = it
      if NS.items then NS.items.see(link) end
    end
  end
end

NS.on("MERCHANT_SHOW", scan)
NS.on("MERCHANT_UPDATE", scan)
