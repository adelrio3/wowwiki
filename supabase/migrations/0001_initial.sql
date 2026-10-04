-- WoW Compendium: initial schema. Binding names per docs/02-data-model.md.
-- The database is permanent (D-0034); later changes are migrations.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type flavor as enum ('era', 'anniversary', 'mists', 'retail', 'forever');
create type upload_status as enum ('received', 'ingesting', 'ingested', 'failed');
create type fact_status as enum ('unconfirmed', 'confirmed', 'disputed', 'retired', 'overridden');
create type entity_type as enum (
  'creature', 'gameobject', 'item', 'quest', 'spell', 'map', 'area', 'zone_text',
  'faction', 'instance', 'encounter', 'taxi_node', 'skill_line', 'recipe',
  'achievement', 'currency', 'title', 'class', 'race', 'gossip', 'lore_text',
  'speech_line', 'scene'
);
create type value_kind as enum ('num', 'text', 'json', 'bool');
create type account_role as enum ('user', 'moderator', 'admin', 'owner');
create type override_action as enum ('correct', 'hide', 'merge', 'confirm', 'retire');
create type observation_source as enum ('encounter', 'client_catalog');
create type realm_trust as enum ('provisional', 'official', 'blocked');

-- ---------------------------------------------------------------- reference (hand-maintained)
create table builds (
  flavor flavor not null,
  build integer not null,
  patch text not null,
  expansion text not null,
  interface integer,
  released_at date,
  classified boolean not null default true,
  primary key (flavor, build)
);

create table realms (
  id bigserial primary key,
  flavor flavor not null,
  region smallint not null,
  slug text not null,
  name text not null,
  client_realm_id integer,
  connected_group text,
  first_seen_at timestamptz not null default now(),
  trust_level realm_trust not null default 'provisional',
  unique (flavor, region, slug)
);

create table realm_phases (
  realm_id bigint not null references realms(id) on delete cascade,
  phase text not null,
  started_at timestamptz not null,
  primary key (realm_id, phase)
);

-- ---------------------------------------------------------------- accounts
create table accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text unique,
  battletag text,
  visibility jsonb not null default '{}'::jsonb,
  trust_score numeric not null default 0,
  trusted boolean not null default false,
  role account_role not null default 'user',
  link_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  comment_banned boolean not null default false
);

create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table addon_identities (
  id text primary key,
  account_id uuid references accounts(id) on delete set null,
  flavor flavor,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  held_for_review boolean not null default false
);

-- ---------------------------------------------------------------- L0 uploads
create table uploads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  addon_identity text references addon_identities(id),
  flavor flavor not null,
  flavor_folder text,
  build integer,
  locale text,
  region smallint,
  storage_path text not null,
  sha256 text not null unique,
  byte_size integer not null,
  received_at timestamptz not null default now(),
  ingested_at timestamptz,
  ingest_status upload_status not null default 'received',
  ingest_error text,
  schema_version integer,
  addon_version text,
  addon_modified boolean not null default false,
  observation_count integer,
  raw_deleted_at timestamptz,
  keep_as_fixture boolean not null default false
);
create index uploads_account_idx on uploads(account_id, received_at desc);
create index uploads_status_idx on uploads(ingest_status) where ingest_status in ('received', 'ingesting');

-- ---------------------------------------------------------------- characters and sessions
create table characters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  flavor flavor not null,
  region smallint,
  realm_id bigint references realms(id),
  player_guid text not null,
  name text not null,
  class_id smallint,
  class text,
  race_id smallint,
  race text,
  faction text,
  sex smallint,
  level smallint,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (flavor, player_guid)
);
create index characters_account_idx on characters(account_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  upload_id uuid references uploads(id) on delete set null,
  seq integer not null,
  started_at timestamptz,
  ended_at timestamptz,
  flavor flavor not null,
  build integer,
  phase text,
  reload boolean not null default false,
  level_start smallint,
  level_end smallint,
  unique (character_id, seq)
);

-- ---------------------------------------------------------------- L1 observations (append-only, compacted per D-0023)
create table observations (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  character_id uuid references characters(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  flavor flavor not null,
  build integer not null,
  locale text not null,
  region smallint,
  realm_id bigint references realms(id),
  server_time timestamptz not null,
  entity_type entity_type not null,
  entity_id bigint not null default 0,
  entity_key text not null default '',
  field text not null,
  value_kind value_kind not null,
  value_num double precision,
  value_text text,
  value_json jsonb,
  map_id integer,
  pos_x real,
  pos_y real,
  instance_id integer,
  world_x real,
  world_y real,
  source observation_source not null default 'encounter',
  tombstoned boolean not null default false
);
create index observations_entity_idx on observations(flavor, entity_type, entity_id, entity_key, field);
create index observations_upload_idx on observations(upload_id);
create index observations_account_idx on observations(account_id);
create index observations_session_idx on observations(session_id);

-- ---------------------------------------------------------------- L2 facts (rebuildable)
create table facts (
  id bigserial primary key,
  flavor flavor not null,
  entity_type entity_type not null,
  entity_id bigint not null default 0,
  entity_key text not null default '',
  field text not null,
  locale text not null default '',
  value_hash text not null,
  value_kind value_kind not null,
  value_num double precision,
  value_text text,
  value_json jsonb,
  first_build integer not null,
  last_build integer not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  contributor_count integer not null default 0,
  observation_count integer not null default 0,
  pending_count integer not null default 0,
  status fact_status not null default 'unconfirmed',
  source observation_source not null default 'encounter',
  api_agrees boolean,
  updated_at timestamptz not null default now(),
  unique (flavor, entity_type, entity_id, entity_key, field, locale, value_hash)
);
create index facts_entity_idx on facts(flavor, entity_type, entity_id, entity_key);
create index facts_name_idx on facts(flavor, entity_type, field, locale) where field = 'name';

create table relations (
  id bigserial primary key,
  flavor flavor not null,
  from_type entity_type not null,
  from_id bigint not null,
  rel text not null,
  to_type entity_type not null,
  to_id bigint not null,
  first_build integer not null,
  last_build integer not null,
  numerator integer not null default 0,
  denominator integer not null default 0,
  contributor_count integer not null default 0,
  status fact_status not null default 'unconfirmed',
  updated_at timestamptz not null default now(),
  unique (flavor, from_type, from_id, rel, to_type, to_id)
);
create index relations_to_idx on relations(flavor, to_type, to_id, rel);

create table positions (
  id bigserial primary key,
  flavor flavor not null,
  entity_type entity_type not null,
  entity_id bigint not null,
  map_id integer,
  cluster_x real,
  cluster_y real,
  instance_id integer,
  world_x real,
  world_y real,
  radius real not null default 0,
  observation_count integer not null default 0,
  contributor_count integer not null default 0,
  first_build integer not null,
  last_build integer not null,
  updated_at timestamptz not null default now()
);
create index positions_entity_idx on positions(flavor, entity_type, entity_id);
create index positions_map_idx on positions(flavor, map_id);

-- ---------------------------------------------------------------- L3 overrides and audit
create table overrides (
  id uuid primary key default gen_random_uuid(),
  flavor flavor not null,
  entity_type entity_type not null,
  entity_id bigint not null default 0,
  entity_key text not null default '',
  field text,
  locale text not null default '',
  action override_action not null,
  value_json jsonb,
  build_from integer,
  build_to integer,
  reason text not null,
  created_by uuid references accounts(id),
  created_at timestamptz not null default now(),
  superseded_by uuid references overrides(id)
);
create index overrides_entity_idx on overrides(flavor, entity_type, entity_id, entity_key) where superseded_by is null;

create table audit_log (
  id bigserial primary key,
  actor_id uuid,
  actor_hash text,
  action text not null,
  target text not null,
  before_json jsonb,
  after_json jsonb,
  at timestamptz not null default now()
);

create table api_disagreements (
  id bigserial primary key,
  flavor flavor not null,
  entity_type entity_type not null,
  entity_id bigint not null,
  field text not null,
  api_json jsonb,
  observed_json jsonb,
  checked_at timestamptz not null default now(),
  resolved_by uuid references accounts(id),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------- Journal
create table journal_events (
  id bigserial primary key,
  character_id uuid not null references characters(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  kind text not null,
  at timestamptz not null,
  map_id integer,
  pos_x real,
  pos_y real,
  instance_id integer,
  world_x real,
  world_y real,
  payload jsonb not null default '{}'::jsonb
);
create index journal_events_character_idx on journal_events(character_id, at desc);
create index journal_events_kind_idx on journal_events(character_id, kind, at desc);

create table character_sightings (
  character_id uuid not null references characters(id) on delete cascade,
  entity_type entity_type not null,
  entity_id bigint not null,
  first_at timestamptz not null,
  last_at timestamptz not null,
  count integer not null default 1,
  first_session_id uuid references sessions(id) on delete set null,
  primary key (character_id, entity_type, entity_id)
);

create table character_stats (
  character_id uuid not null references characters(id) on delete cascade,
  stat_key text not null,
  value_num numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (character_id, stat_key)
);

create table character_state (
  character_id uuid not null references characters(id) on delete cascade,
  kind text not null,
  key text not null,
  value_json jsonb,
  as_of timestamptz not null,
  primary key (character_id, kind, key)
);

create table achievement_progress (
  character_id uuid not null references characters(id) on delete cascade,
  achievement_key text not null,
  criteria_json jsonb not null default '{}'::jsonb,
  earned_at timestamptz,
  points integer not null default 0,
  reward_json jsonb,
  updated_at timestamptz not null default now(),
  primary key (character_id, achievement_key)
);

create table account_achievements (
  account_id uuid not null references accounts(id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null,
  character_id uuid references characters(id) on delete set null,
  points integer not null default 0,
  reward_json jsonb,
  primary key (account_id, achievement_key)
);

create table leaderboard_entries (
  board_key text not null,
  scope text not null default 'global',
  account_id uuid not null references accounts(id) on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  value numeric not null,
  rank integer,
  at timestamptz not null default now(),
  primary key (board_key, scope, account_id, character_id)
);

-- ---------------------------------------------------------------- comments and reports (D-0033)
create table comments (
  id uuid primary key default gen_random_uuid(),
  flavor flavor not null,
  entity_type entity_type not null,
  entity_id bigint not null default 0,
  entity_key text not null default '',
  account_id uuid references accounts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references accounts(id)
);
create index comments_entity_idx on comments(flavor, entity_type, entity_id, entity_key, created_at desc) where deleted_at is null;

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references accounts(id) on delete set null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references accounts(id)
);

-- ---------------------------------------------------------------- account creation trigger
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- helpers
create or replace function current_account_role()
returns account_role
language sql
stable
security definer
set search_path = public
as $$
  select role from accounts where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(current_account_role() in ('admin', 'owner'), false);
$$;

-- ---------------------------------------------------------------- row level security
alter table builds enable row level security;
alter table realms enable row level security;
alter table realm_phases enable row level security;
alter table accounts enable row level security;
alter table device_tokens enable row level security;
alter table addon_identities enable row level security;
alter table uploads enable row level security;
alter table characters enable row level security;
alter table sessions enable row level security;
alter table observations enable row level security;
alter table facts enable row level security;
alter table relations enable row level security;
alter table positions enable row level security;
alter table overrides enable row level security;
alter table audit_log enable row level security;
alter table api_disagreements enable row level security;
alter table journal_events enable row level security;
alter table character_sightings enable row level security;
alter table character_stats enable row level security;
alter table character_state enable row level security;
alter table achievement_progress enable row level security;
alter table account_achievements enable row level security;
alter table leaderboard_entries enable row level security;
alter table comments enable row level security;
alter table reports enable row level security;

-- World Wiki: readable by everyone, writable only by the service role.
create policy "public read builds" on builds for select using (true);
create policy "public read realms" on realms for select using (true);
create policy "public read realm_phases" on realm_phases for select using (true);
create policy "public read facts" on facts for select using (true);
create policy "public read relations" on relations for select using (true);
create policy "public read positions" on positions for select using (true);
create policy "public read overrides" on overrides for select using (true);
create policy "public read leaderboards" on leaderboard_entries for select using (true);
create policy "public read comments" on comments for select using (deleted_at is null);

-- Accounts: a user reads and updates their own row (limited columns enforced in the API).
create policy "own account read" on accounts for select using (auth.uid() = id);
create policy "own account update" on accounts for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "own device tokens" on device_tokens for select using (auth.uid() = account_id);
create policy "own uploads" on uploads for select using (auth.uid() = account_id);
create policy "own identities" on addon_identities for select using (auth.uid() = account_id);

-- Journal: the owning account reads its own rows. Public profiles are served
-- by the site with the service role after checking accounts.visibility.
create policy "own characters" on characters for select using (auth.uid() = account_id);
create policy "own sessions" on sessions for select using (
  exists (select 1 from characters c where c.id = sessions.character_id and c.account_id = auth.uid())
);
create policy "own journal events" on journal_events for select using (
  exists (select 1 from characters c where c.id = journal_events.character_id and c.account_id = auth.uid())
);
create policy "own sightings" on character_sightings for select using (
  exists (select 1 from characters c where c.id = character_sightings.character_id and c.account_id = auth.uid())
);
create policy "own stats" on character_stats for select using (
  exists (select 1 from characters c where c.id = character_stats.character_id and c.account_id = auth.uid())
);
create policy "own state" on character_state for select using (
  exists (select 1 from characters c where c.id = character_state.character_id and c.account_id = auth.uid())
);
create policy "own achievement progress" on achievement_progress for select using (
  exists (select 1 from characters c where c.id = achievement_progress.character_id and c.account_id = auth.uid())
);
create policy "own account achievements" on account_achievements for select using (auth.uid() = account_id);

-- Comments and reports: signed-in users write their own.
create policy "insert own comment" on comments for insert with check (
  auth.uid() = account_id and not coalesce((select comment_banned from accounts where id = auth.uid()), true)
);
create policy "insert own report" on reports for insert with check (auth.uid() = reporter_id);
create policy "own reports read" on reports for select using (auth.uid() = reporter_id or is_admin());

-- Admin visibility.
create policy "admin read audit" on audit_log for select using (is_admin());
create policy "admin read disagreements" on api_disagreements for select using (is_admin());
create policy "admin read observations" on observations for select using (is_admin());
create policy "admin read all uploads" on uploads for select using (is_admin());

-- ---------------------------------------------------------------- storage buckets
insert into storage.buckets (id, name, public) values
  ('uploads', 'uploads', false),
  ('assets', 'assets', true),
  ('addon-releases', 'addon-releases', true)
on conflict (id) do nothing;

create policy "public read assets" on storage.objects for select using (bucket_id in ('assets', 'addon-releases'));

-- ---------------------------------------------------------------- seed reference data
insert into builds (flavor, build, patch, expansion, interface, released_at)
values ('era', 70003, '1.15.9', 'Classic', 11509, '2026-09-23')
on conflict do nothing;
