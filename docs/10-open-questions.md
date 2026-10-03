# 10. Open Questions

Three sections. Only the first needs the owner's answer. Each question there is
written to be answerable from this file alone, with a recommended answer and what
changes if the owner picks differently. Resolve a question by recording the answer in
`09-decisions.md` and deleting it here.

## A. Decisions only the owner can make

None open.

## B. Things the owner does (no decision, just a task)

### B1. Run the probe

Install the probe add-on from `addon/WoWCompendiumProbe/` following its README,
play Classic Era for twenty to thirty minutes doing the listed activities, type
`/reload`, and send the resulting `WoWCompendiumProbe.lua` file. Repeat on the
Anniversary client if a character exists there. This settles every `VERIFY` item in
`03`, the Anniversary add-on file naming, and most of the engineering questions
below. Nothing else is needed from the owner for verification.

## C. Engineering questions (resolved by the team, no owner input)

- Which Classic Era APIs exist: answered by the probe.
- Anniversary client TOC suffix and project ID: answered by the probe run there.
- WoW: Forever at launch (2026-11-04): folder name, TOC suffix, project ID, interface
  version; whether its add-on API matches Era's. Run the probe there after launch.
- Detecting that the game is running, from the browser, before writing add-on
  updates: test whether the client holds a lock on any file we can probe; otherwise
  ask the user. The helper checks the process list.
- Netlify background function limits with a 10 MB upload: measure in Phase 1.
- Observation table partitioning: by flavor only, or flavor plus month. Decide from
  measured volume in Phase 2.
- Chrome persistent folder permission when the site is installed as an app versus a
  normal tab: test in Phase 1; may recommend "install as app".
- Dedupe key for speech scenes when line order varies between contributors.
- Blizzard API coverage for Classic Era media: verify with a developer client in
  Phase 4.
- Classic Era achievement catalog (D-0032): drafted by the team in Phase 3, then
  reviewed by the owner as a list in chat, not in a file.
