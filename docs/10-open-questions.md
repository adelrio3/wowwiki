# 10. Open Questions

Items the owner must decide, or that need verification in the live client. Resolve by
moving the answer into `09-decisions.md` (for decisions) or into the relevant doc (for
verifications), then delete the item here.

## Under discussion (blocking the owner decisions below)

**D. Meaning of "public".** Confirm whether an opted-in public Journal profile is
visible to anyone with the link (including logged-out visitors) or only to signed-in
users. The World Wiki is visible to everyone regardless.

## Owner decisions

1. **Login line wording and frequency.** Proposed: at most once per login, only when
   unsynced data exists or the add-on is unlinked, mentioning the site and the future
   helper. Confirm or adjust. The helper mention could be dropped until it exists.
2. **Stack confirmation.** SvelteKit + TypeScript (D-0013). Overrule now or never.
3. **Classic Era achievement specifics.** The reconstructed catalog in `06` has gaps
   marked "decision needed" (Diplomat composition, which Feats of Strength, which fun
   originals). Review the list once the engine exists; no need to settle it before
   Phase 3.
4. **Loremaster continent thresholds.** Proposed 550 Eastern Kingdoms, 700 Kalimdor,
   tunable. Confirm.
5. **Zone-level achievement freeze rule.** Achievements that depend on the wiki's
   catalog cannot be earned until an admin freezes the zone's list. Confirm this is
   acceptable versus earning them against a moving target.
6. **Rare-spawn achievements.** Same freeze rule. Confirm.
7. **Leaderboard identity.** Display name by default; character names opt-in. Confirm.
8. **Terms of service wording.** Draft exists in `07`. Needs a proper pass before
   Phase 4; no decision now.
9. **Reports and comments.** Reports yes, public comments no, in the first release.
   Confirm.
10. **CurseForge/Wago distribution.** Deferred. Confirm it stays deferred.
11. **Helper nag frequency.** Proposed once per day per client. Confirm.
12. **Open source?** Free Windows code signing (SignPath Foundation) requires a public
    repository under an open-source license. The owner said there are no license
    considerations. Confirm whether the repository may be public with an open-source
    license; if yes, we apply once the helper exists.

## Verifications in the live client (owner runs; see checklist in `03`)

13. All twelve items in the `03` verification checklist. A debug build of the add-on
    will produce the dump; until then these stay open.
14. **Anniversary client**: TOC suffix the `_anniversary_` client loads
    (`_TBC`, `_Anniversary`, or other), its `WOW_PROJECT_ID`, and its interface
    version.
15. **Game running detection** for safe add-on updates from the browser (`04`): is
    there a reliable file-based signal, or do we just ask the user? (The helper can
    check the process list.)
16. **WoW: Forever at launch (2026-11-04)**: launch folder name, TOC suffix,
    `WOW_PROJECT_ID`, interface version, and whether the beta add-on API matches Era's.
    One third-party source claims Forever shares the retail binary; unverified.

## Engineering questions (resolve during Phase 1)

17. Netlify background function limits with a 10 MB upload: measure before deciding
    whether a separate worker is needed.
18. Observation table partitioning strategy: by flavor only, or flavor plus month.
19. Chrome persistent permission behavior when the site is installed as a PWA versus a
    normal tab; whether to recommend "install as app" for one-click syncing.
20. Exact dedupe key for speech scenes across contributors when line order varies.
21. Blizzard API coverage for `static-classic1x`: which media endpoints exist for
    Era (items and creature displays are confirmed by forum posts; spells and others
    unknown). Verify with a developer client in Phase 4.
