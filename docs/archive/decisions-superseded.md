# Superseded decisions (archive)

Full text of decisions that have been superseded. Kept for history only. Do not read
this file for guidance; the active log is `docs/09-decisions.md`.

## D-0004: Browser folder access is the transport; no required local software
Date: 2026-10-03  Status: accepted
Context: Add-ons cannot network; browsers cannot read disk unprompted. The owner does
not want users to install anything.
Decision: Use the File System Access API in Chromium browsers for install, update,
removal, reading, and ack. Manual fallback elsewhere. An optional helper may come
later and is advertised when unsynced data is detected, at most once per day.
Consequences: Chromium-only for the smooth path. Sync happens only when the site is
open. The owner accepted both.

## D-0007: Artwork via our own extraction pipeline
Date: 2026-10-03  Status: accepted
Context: The add-on can export icon file IDs but not images. The owner is willing to
obtain assets elsewhere and keep them.
Decision: An admin-only command-line tool, run by the owner against their own game
client, extracts icons and map tiles using an open-source CASC extractor library and
uploads them to our storage keyed by file data ID. We do not scrape Wowhead (their
terms forbid it) and do not depend on third-party ID-to-name tables.
Consequences: Artwork lags behind data until the owner runs the tool per client build.
Pages render without art gracefully.

## D-0008: Version by build, display by expansion
Date: 2026-10-03  Status: accepted
Context: Data changes patch to patch; readers think in expansions.
Decision: Observations carry build; facts carry build intervals; pages collapse to
expansion with patch-change notes and an expandable history.
Consequences: A hand-maintained build→patch→expansion table in `game-meta`. Unknown
builds are flagged for classification.


## D-0016: Raw uploads are immutable and retained forever
Date: 2026-10-03  Status: superseded by D-0023
Context: "Preserve the world" plus the ability to fix pipeline bugs without losing
history.
Decision: Every upload is stored as received. All derived data is rebuildable through
reprocessing. Account deletion removes the user's raw uploads but tombstones, not
deletes, derived observations.
Consequences: Terms must say wiki contributions are irrevocable and anonymous after
deletion.

## D-0027: Leaderboards show character names by default
Date: 2026-10-03  Status: superseded by D-0031
Context: Leaderboards are opt-in; the question was what to show once opted in.
Decision: Character name and realm by default, with an option to show the account's
display name instead.
Alternatives: display name by default (less recognizable to other players).
Consequences: None beyond the setting.

## D-0035: Design direction
Date: 2026-10-04  Status: accepted
Context: The first slice was unstyled plumbing; the owner wants a very good UI and
UX next and deferred the direction to the team's recommendation.
Decision: "An archive, not a game interface" per docs/12: dark by default with a
light theme, warm paper-and-gold palette, Fraunces for display and Inter for text,
dense wiki pages with a strict hierarchy, lighter Journal, a guided Sync page.
Alternatives: game-styled chrome with ornate frames (dates fast, fights dense data);
uniform spacious layouts (wiki pages become long scrolls); dark only (reference
sites are read in daylight).
Consequences: docs/12 is binding on every page; the design lands before Phase 2
pages so each new entity page is built once.
