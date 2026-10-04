-- The helper reports its state to the site (D-0043): the Add-on page shows it
-- and can ask the helper to act. All columns are written by the service role.
alter table device_tokens
  add column helper_version text,
  add column state jsonb not null default '{}'::jsonb,
  add column last_seen_at timestamptz,
  add column pending_action text;
