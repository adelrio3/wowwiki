-- Relation attributes (D-0048): what a vendor charges, the quantity range a
-- source drops. Edge-specific values that are not facts of either end.
alter table relations add column if not exists attrs jsonb;
