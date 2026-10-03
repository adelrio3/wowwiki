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

