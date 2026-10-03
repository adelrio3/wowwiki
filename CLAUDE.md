# WoW Compendium: instructions for AI coding sessions

WoW Compendium is a public, multi-user wiki of World of Warcraft built **only** from
data captured by our own in-game add-on, plus a per-account / per-character "Journal"
with progress tracking and an achievement system.

The design documents in `docs/` are the source of truth. Code follows the docs, never
the other way around. The owner's explicit goal is to get the design right before
writing code so that the first implementation is close to final and does not accumulate
AI-generated churn.

## Before you do anything

1. Read `docs/00-vision-and-scope.md` in full. It defines the two products (World Wiki
   and Journal), the principles, and the glossary. Use the glossary's words.
2. Read the document(s) covering the area you are touching (index below).
3. Read `docs/09-decisions.md`. Do not re-open a decided question unless the owner does.
   Never read `docs/archive/` unless the owner asks about history; it holds rejected
   reasoning.
4. Check `docs/10-open-questions.md`. If your task depends on an open question, ask the
   owner rather than assume. Do everything that does not depend on it first.

## When direction changes

- Every new product or architecture decision gets an entry in `docs/09-decisions.md`
  using the format in that file, in the same commit as the change.
- Update the affected design document in the same commit as the code.
- Code and docs must never disagree. If they must for a moment, add an open question.
- Do not invent names. If a concept is not in the glossary, add it there first.

## Document index

| Doc | Covers |
|-----|--------|
| `docs/00-vision-and-scope.md` | Purpose, the two products, principles, scope, non-goals, glossary |
| `docs/01-architecture.md` | Components, data flow, stack, hosting, repo layout, testing |
| `docs/02-data-model.md` | Data layers, identity and keys, versioning by build, localization, schemas |
| `docs/03-addon-capture-spec.md` | What the add-on captures, per entity type, events and APIs, per flavor |
| `docs/04-sync-and-transport.md` | Browser folder access, install/uninstall, ack file, upload, pruning |
| `docs/05-trust-and-moderation.md` | Consensus, trust scores, bad data, admin overrides, audit |
| `docs/06-progress-and-achievements.md` | Journal content, achievement mirroring and reconstruction, leaderboards |
| `docs/07-privacy-and-accounts.md` | Auth, account linking, data inventory, visibility, deletion |
| `docs/08-roadmap.md` | Phases with exit criteria |
| `docs/09-decisions.md` | Decision log (ADRs) |
| `docs/10-open-questions.md` | Unresolved questions with owner |

## Hard rules

- **Wiki data comes only from add-on captures.** No imports from Wowhead, the Blizzard
  API, or community dumps. The single exception is artwork (icons, map images), which
  is handled by the asset pipeline described in `docs/01-architecture.md`.
- **Objective vs. experiential.** Anything subjective or specific to one player's
  experience never enters the World Wiki. It belongs to the Journal.
- **Provenance is never lost.** Every fact traces to the accounts and builds that
  reported it. Retention limits are set in `docs/02-data-model.md` once decided.
- **Every observation carries** flavor, client build, locale, region, realm, server
  timestamp, and the contributing account.
- **Private by default.** Public sharing of Journal data is opt-in, per setting.
- **The add-on has no in-game UI.** The only in-game output is a single chat-frame
  line at login (see `docs/04-sync-and-transport.md`).
- **Two transports, one code.** Browser sync and the helper both use
  `packages/sync-core`. Never implement sync logic in only one of them.
- **Nothing against Blizzard's add-on policy.** No automation, no gameplay assistance,
  no obfuscated code, no in-game solicitation.
- **No model names or AI attribution** in code, comments, or committed files other
  than commit trailers.

## Conventions

- Monorepo, pnpm workspaces. See `docs/01-architecture.md` for layout.
- TypeScript everywhere outside the add-on. Lua 5.1 dialect for the add-on
  (WoW's Lua). No Lua features beyond what the WoW client supports.
- Database changes only via Supabase migrations in `supabase/migrations/`. Never
  edit the schema by hand in the dashboard.
- Write tests for pure logic (parsers, aggregation, achievement criteria). Do not
  write tests that only restate the implementation.
- Commit messages: imperative subject, body explains why. One concern per commit.
- The owner is the first and, for now, only tester. Anything that needs verification
  in the live game client is marked `VERIFY` in the docs; collect those and ask the
  owner to check them in batches.
