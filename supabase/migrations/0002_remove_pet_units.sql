-- Remove player pets that add-on 0.2.0 recorded as creatures (D-0038, N-0019).
-- Pets belong to a player, not to the world. Journal events are untouched.
-- Safe to run more than once: the second run deletes nothing. The facts rows go
-- last because they hold the guid_type marker the other deletes key on.

delete from positions p
where p.entity_type = 'creature'
  and exists (select 1 from facts f where f.entity_type = 'creature' and f.field = 'guid_type' and f.value_text = 'Pet' and f.flavor = p.flavor and f.entity_id = p.entity_id);

delete from observations o
where o.entity_type = 'creature'
  and exists (select 1 from facts f where f.entity_type = 'creature' and f.field = 'guid_type' and f.value_text = 'Pet' and f.flavor = o.flavor and f.entity_id = o.entity_id);

delete from facts x
where x.entity_type = 'creature'
  and exists (select 1 from facts f where f.entity_type = 'creature' and f.field = 'guid_type' and f.value_text = 'Pet' and f.flavor = x.flavor and f.entity_id = x.entity_id);
