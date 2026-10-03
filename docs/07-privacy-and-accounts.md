# 07. Privacy and Accounts

## Accounts

- Supabase Auth. Email magic link at launch; Google and Discord OAuth can be added.
  Battle.net OAuth is possible later for convenience but is not needed for any data.
- One Compendium account per person. It owns all their addon identities, characters,
  uploads, and Journal data across all flavors and WoW licenses.
- Display name is chosen by the user and shown anywhere public. Email is never shown.

## Linking the add-on to an account

Done by the link file (`04`). The token is per account, opaque, revocable, rotatable.
The first upload from an addon identity binds it to the account that uploaded it. A
later upload of the same identity by a different account is held for review (`05`).

## Data inventory

| Data | Stored where | Default visibility | Notes |
|------|-------------|-------------------|-------|
| Email, auth metadata | Supabase Auth | Owner only | Never displayed. |
| Display name | `accounts` | Public | Chosen by user. |
| BattleTag | `accounts.battletag` (from `BNGetInfo()`) | Private, opt-in to show | Stored so the user can see it on their own profile; shared only when opted in. |
| WoW account folder name | Nowhere | n/a | Never read beyond path enumeration in the browser; never sent. |
| Addon identity UUID | `addon_identities` | Private | Random, no link to Blizzard identity. |
| Characters (name, realm, class, level, guild, etc.) | `characters` | Private, opt-in public | |
| Journal events, statistics, achievements | Journal tables | Private, opt-in public per section | Sections: overview, timeline, achievements, statistics, kills/deaths, loot, social. |
| Other players seen (name, realm, class, guild, level, inspected gear) | `journal` social tables | Private to the account that saw them | Never aggregated publicly. Users can request removal of their own name from others' Journals (by character name + realm), applied as a redaction rule. |
| Group members in encounters | encounter events | Private; on public profiles shown as "group of N" unless each named player has opted in to public profiles | |
| NPC speech directed at the player (contains player name) | Journal (raw), wiki (name replaced by placeholder) | Wiki version public | |
| Raw uploads | Storage `uploads` | Owner and admins | Deleted 90 days after ingest, or immediately on account deletion. |
| Observations | `observations` | Not directly visible | Contain `account_id`. On account deletion the column is set to a tombstone id; the rows stay so wiki facts survive. |
| Leaderboard entries | `leaderboard_entries` | Public, opt-in | Removed when opt-out. |
| Audit log | `audit_log` | Admins | Admin actions only. |

Experiential data about other players is allowed because it is what the user saw in
their own client. We stay conscientious: it is private to the observer, not pooled, and
redactable on request. Each new use is decided case by case and recorded in `09`.

## Visibility settings

Per account, each off by default:

- Public profile (characters list, overview).
- Public sections: timeline, achievements, statistics, kills and deaths, loot, social.
- Leaderboard participation (requires public profile).
- Show BattleTag on profile.
- Show the account's display name on leaderboards instead of character names
  (character names are the default, D-0027).

Settings apply immediately to rendering; leaderboards update on their next
recomputation (minutes, not days). Anything opted in is visible to anyone with the
link, signed in or not (D-0026).

## Deletion and export

- **Export**: a zip of raw uploads plus JSON of Journal tables, generated on demand.
- **Delete account**: removes auth user, accounts row, addon identities, characters,
  Journal tables, leaderboard entries, raw uploads, and the link token. Observations
  are tombstoned (account reference replaced) so already-aggregated wiki facts remain,
  which the terms of service state clearly: contributions to the world wiki are
  irrevocable and anonymous after deletion. Admin audit log entries that reference the
  account keep a hashed reference only.
- **Delete a character**: same, scoped to the character.
- Deletion runs as a background job and completes within 24 hours; raw uploads are
  removed immediately.

## Terms, in plain language (to be written properly later)

- The wiki is built from what players' clients saw. By uploading, you contribute
  observations to a public dataset, anonymously.
- Your Journal is yours and private until you say otherwise.
- We do not sell data. There is no monetization.
- We follow Blizzard's add-on policy. World of Warcraft and all game content are
  Blizzard's property; this is a fan project.
