# 05. Trust and Moderation

The World Wiki is public and anyone can contribute. Input is untrusted by default.
This document covers how bad data is kept out of what readers see, without blocking
honest contributors or losing anything.

## Threats

- Tampered SavedVariables (hand-edited values).
- Modified add-on reporting fabricated observations.
- Private-server clients with different data posing as official realms.
- Honest bugs in a specific add-on version producing systematically wrong values.
- Honest edge cases: level-scaled creatures, phased NPCs, seasonal variants, locale
  mix-ups.
- Replay: uploading the same sessions many times to inflate counts.

## Defenses, layered

1. **Immutable provenance.** Every observation keeps its upload, account, addon
   identity, add-on version, build, realm, and time. Nothing is ever merged in a way
   that loses who said it.
2. **Consensus.** A fact needs two or more distinct **accounts** to be confirmed.
   Distinctness is by Compendium account, not by character or addon identity.
3. **Trust score per account.** Starts at neutral. Rises as the account's unconfirmed
   facts get confirmed by others. Falls when its values are contradicted by a
   confirmed majority. Accounts below a threshold contribute observations that are
   stored but excluded from status computation until reviewed.
4. **Trusted accounts.** An admin flag that makes an account count as two contributors.
   The owner's account is trusted from day one so single-tester data shows as
   confirmed during bootstrap. Trusted status is visible in the audit log and can be
   revoked.
5. **Add-on integrity flag.** Uploads whose installed add-on files did not match the
   release manifest at sync time are flagged `addon_modified`. They are stored, shown in
   the Journal, and excluded from wiki status computation.
6. **Add-on version quarantine.** An admin can quarantine a specific add-on version or
   module. Observations from it are excluded from status computation and re-included
   after reprocessing with a fix.
7. **Realm registry.** Realms are created from observations. A realm is `provisional`
   until observed by N accounts (configurable, initial 3) or marked `official` by an
   admin. Observations from provisional realms are stored but do not confirm facts.
   The region, build, and connected-realm list give further sanity checks.
8. **Sanity rules at ingest.** Build must be a known or plausible build for the flavor.
   Timestamps must be within the upload's window. Counters must be monotonic within a
   session. Values must be in-range for their field (level 1 to the flavor's cap, etc.).
   Violations reject the session, not the upload, with a reason the user can see.
9. **Replay protection.** Observations are deduplicated by `(character, session seq)`.
   A character belongs to exactly one account; a second account claiming the same player
   GUID is held for review.
10. **Rate limits.** Uploads per account per day, bytes per day, sessions per upload.
11. **Overrides and audit.** See below.

## Status computation

Runs in the aggregate function per `(flavor, entity, field)`:

1. Collect observations from eligible accounts (trust above threshold, not quarantined,
   realm not provisional, upload not flagged).
2. Group by value (per locale for text) and by build interval.
3. Count distinct accounts per value within overlapping build ranges.
4. Apply status rules from `02`. Supermajority for disputes: 80% of accounts in the
   overlapping range.
5. Write facts; keep ineligible observations counted separately as `pending_count` so
   admins can see what is waiting.

Time-varying truths (an NPC moved in a patch) resolve naturally through build
intervals: both values are confirmed, in different ranges.

## Administrator overrides

Admin actions on wiki data are limited to:

- `correct`: set a field value for an entity (per locale for text), optionally bounded
  to a build range, with a required reason.
- `hide`: hide a fact or an entity from public view, with reason.
- `merge`: declare two entity IDs the same thing (rare; for GUID-type quirks).
- `confirm`: force a fact to confirmed, with reason.
- `retire`: mark an entity as no longer existing from a build onward.

Every action writes an `overrides` row and an `audit_log` row with before and after.
Overrides never modify observations or facts; the view layer applies them. Overrides
can be superseded by newer overrides and reverted. The audit log is append-only and
visible to all admins; a public "edit history" on each page shows that an admin
correction exists and when, without exposing admin identity beyond a display name.

Roles: `user`, `moderator` (can hide and flag, cannot correct), `admin` (all),
`owner` (admin plus role management). Only the owner at launch.

## Moderation queue

Admin UI lists: failed ingests, flagged uploads, disputed facts ordered by reader
traffic, provisional realms, accounts near the trust threshold, duplicate character
claims, unknown builds awaiting classification. Each item has the minimal actions
above.

## Reprocessing

Because uploads are immutable, any fix to the parser, the schema mapping, or the
aggregation can be applied to history: `reprocess(upload_ids | all)` truncates derived
observations for those uploads and re-ingests. Facts are rebuilt incrementally.
Reprocessing is an admin action with an audit entry and runs as background jobs.

## Reporting

Any logged-in user can report a wiki page or fact with a reason. Reports land in the
queue. There is no public comment system in the first release.
