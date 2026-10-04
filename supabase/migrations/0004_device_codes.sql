-- Device sign-in for the helper (docs/04 "The helper", docs/07). The helper
-- creates a short code, the user approves it on the site while signed in, and
-- the helper collects a device token once. Codes expire after ten minutes.
create table device_codes (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  account_id uuid references accounts(id) on delete cascade,
  approved_at timestamptz,
  -- the plaintext token, present only between approval and the helper's one pickup
  token text,
  claimed_at timestamptz
);
alter table device_codes enable row level security;
-- no policies: only the service role reads or writes this table
