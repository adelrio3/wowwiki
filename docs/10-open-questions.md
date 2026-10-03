# 10. Open Questions

Three sections. Only the first needs the owner's answer. Each question there is
written to be answerable from this file alone, with a recommended answer and what
changes if the owner picks differently. Resolve a question by recording the answer in
`09-decisions.md` and deleting it here.

## A. Decisions only the owner can make

### A1. Where do Classic Era's achievements come from?

Classic Era has no achievements in the game. Retail, Mists, and later Anniversary
phases do, and for those we copy the game's list exactly. For Era there is nothing in
the client to copy, so someone has to write the Era list.

Recommended: we write it ourselves, once, as part of the product, modeled on the
Wrath of the Lich King achievements that covered this same content. The list is fixed
from the day it ships; achievements are never measured against a changing target and
no administrator ever "freezes" anything. Where an achievement names specific things
(the subzones of Elwynn Forest, the last boss of each dungeon, the factions to reach
Exalted with), those names are part of our achievement design. Each named thing gets a
wiki page immediately; the page is empty of facts until a player observes it, and it
says so. Loremaster uses Wrath's fixed quest counts per continent (550 for Eastern
Kingdoms, 700 for Kalimdor), so it needs no quest list at all.

The one caveat: the names inside the achievement list are written by us, not read
from a game client. They are achievement design, not wiki facts, and the wiki pages
they create carry nothing but that name until observed.

Alternative: wait until a client that contains Wrath-era achievements (Anniversary
realms, in a future phase) and read the list from there. Era would have no
achievements until then, and the Wrath list would need editing anyway because it was
written for a slightly different old world.

Answer needed: "write it ourselves" or "wait for a client that has it".

### A2. Player comments on wiki pages in the first release?

Why they were proposed for later: comments are user-written text, so they need
moderation tools (report, delete, ban, rate limits), they add spam and abuse exposure
for a one-person team, and readers may mistake them for facts, blurring the line that
everything on the wiki was observed.

Why they could ship now: player notes are the most useful part of existing quest and
item databases, and adding them later means redesigning every page.

Recommended: ship them, scoped tightly. Signed-in users only, plain text, no links or
images, a report button, administrator delete and ban, rate limits, and a visual
style that keeps them clearly separate from observed facts.

Answer needed: "yes, scoped" or "not in the first release".

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
- Classic Era achievement catalog details (which Feats of Strength, which fun
  originals, Diplomat composition): drafted by the team in Phase 3, then reviewed by
  the owner as a list in chat, not in a file.
