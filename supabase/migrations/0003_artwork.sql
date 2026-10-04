-- Composed artwork (D-0041): one row per image the site serves, stored in the
-- public "assets" bucket. Never a source of facts.
create table artwork (
  id bigserial primary key,
  flavor flavor not null,
  entity_type entity_type not null,
  entity_id bigint not null,
  kind text not null,                       -- 'map' for a composed zone map
  path text not null,                       -- object path inside the assets bucket
  width integer not null,
  height integer not null,
  build integer not null,                   -- client build the files were read from
  layout_hash text not null,                -- hash of the layout facts that produced it
  pieces integer not null default 0,        -- explored pieces composed on top of the base
  updated_at timestamptz not null default now(),
  unique (flavor, entity_type, entity_id, kind)
);
alter table artwork enable row level security;
create policy "public read artwork" on artwork for select using (true);
