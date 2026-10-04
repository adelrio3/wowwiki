# 12. Design

How the site looks and behaves. Binding for every page; a rebuild (D-0034) starts
from this document, not from the previous code.

## Direction (D-0035, revised 2026-10-04)

**A field guide, not a game interface.** Clean, light-first, and highly readable:
white surfaces on a cool off-white page, dark slate text, one teal accent, hairline
borders, and dense tables with clear headers. It should feel like a well-made modern
reference site, closer to a documentation site than to a game. No textures, no
ornament, no imitation of Blizzard's UI. (The first direction, a warm dark
"archive", was rejected by the owner as unappealing.)

Two registers:

- **World Wiki**: dense and scannable. The key facts of an entity are readable in
  two seconds at the top; detail tables sit below. Status is always visible.
- **Journal**: lighter and more visual. Big numbers, a timeline, a map.

Light by default, dark theme available from the header; the choice is remembered
per browser and follows the system preference until changed.

## Tokens

Defined once in `apps/web/src/app.css` as CSS variables per theme and exposed to
Tailwind through `@theme inline`. Pages use only these names, never raw colors.
Every text-on-background pairing must pass WCAG AA (4.5:1 for body text, 3:1 for
large text); `apps/web/scripts/check-pages.mjs` enforces it on every page in both
themes and two widths, and a change is not deployed until it passes.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `bg` | `#f6f8fa` | `#0b1220` | page background |
| `surface` | `#ffffff` | `#121b2d` | cards, header, tables |
| `surface-2` | `#eef2f6` | `#1a2538` | stripes, inputs, map background |
| `line` | `#d9e0e8` | `#2a3650` | borders |
| `ink` | `#111827` | `#e8eef8` | body text |
| `ink-muted` | `#4b5563` | `#b4c0d3` | secondary text |
| `ink-faint` | `#5b6676` | `#8a98b0` | meta text (still AA on surfaces) |
| `accent` / `accent-strong` / `accent-ink` | `#0f766e` / `#115e59` / `#ffffff` | `#2dd4bf` / `#5eead4` / `#0b1220` | links, primary button and its text |
| `ok` on `ok-soft` | `#166534` on `#dcfce7` | `#6ee7a0` on `#10301f` | confirmed |
| `warn` on `warn-soft` | `#92400e` on `#fef3c7` | `#fcd34d` on `#3a2a08` | disputed |
| `bad` on `bad-soft` | `#991b1b` on `#fee2e2` | `#fca5a5` on `#3c1414` | errors |
| `info` on `info-soft` | `#1e40af` on `#dbeafe` | `#93c5fd` on `#152a4d` | corrected, NPC label |
| `neutral-soft` | `#eef2f6` | `#1a2538` | unconfirmed badge background |

Base element styles live in Tailwind's `base` layer so utilities always win
(N-0018).

## Typography

- **IBM Plex Sans** for everything, 600 weight for headings with slight negative
  tracking. **IBM Plex Mono** for numbers, identifiers, coordinates, builds.
- Scale: 12px badges, 13px meta, 14px tables, 16px body, 20px section, 30px page
  title, 48px on the home page. Line height 1.5 body, 1.2 headings.

Fonts load from Google Fonts with `display=swap`.

## Layout

- Max content width 72rem, 16px side gutters on phones, 24px from `sm` up.
- Header: site name (serif), primary nav (World Wiki, Journal, Sync), a search box
  that goes to `/wiki?q=`, theme toggle, account menu. Sticky, with a hairline
  border; no shadow.
- Footer: one line of attribution, muted.
- Wiki entity pages: a two-column layout from `lg` up. Left: header, key facts,
  sections. Right: a sticky rail with the map panel and "observed by / builds"
  provenance card. Single column below `lg`.
- Journal character page: stat tiles row, then timeline on the left and a map or
  explored-areas card on the right.

## Components (`apps/web/src/lib/ui/`)

| Component | Role |
|-----------|------|
| `Shell` | header with wordmark, nav, search, theme toggle, account; footer |
| `Badge` | status and small labels |
| `Card` | surface with hairline border and optional title |
| `StatTile` | big number with a label |
| `FactList` | definition list in a two-column grid |
| `MapPanel` | SVG map of a uiMap: 10% grid, coordinate labels, points with hover titles and optional links; takes `points: {x, y, label, href?, weight?}` |
| `EntityHeader` | kind line, title, status badge, subtitle |
| `DataTable` | dense table with striped rows, mono numerics |
| `Empty` | empty state with a one-line hint and a call to action |
| `Button` | primary (gold), secondary (outline), quiet (text) |
| `Stepper` | numbered steps for the Sync setup |

Components take data, never fetch. Pages fetch in `+page.server.ts`.

## Page patterns

- **Home**: a short statement of what the site is, live counts (creatures, areas,
  zones, contributors), the most recently observed creatures and zones, and a
  three-step "how it works" with a single call to action.
- **Wiki index**: search box, then browse by kind (Zones, Creatures, Areas, Flight
  points) as dense tables with status and contributor count. Search applies to all.
- **Creature**: header with level and classification in the kind line, subtitle
  under the title, role chips; key facts; "Where it was seen" as one map panel per
  zone with a zone link; health by level; facts table collapsed under details.
- **Zone**: header with map type and parent link; map panel with every creature
  position (hover shows the name, click opens it); creatures table (name, level,
  type, status); areas list; flight points list.
- **Journal index**: character cards with class-tinted accent bar, level, race,
  class, realm, last seen.
- **Journal character**: stat tiles (played, areas explored, deaths, sessions),
  timeline grouped by day with event glyphs, explored areas.
- **Sync**: a stepper (Connect folder, Install add-on, Play and log out, Sync),
  with the current step highlighted; per-client rows under step 2; results under
  step 4; recent uploads table at the bottom.
- **Errors**: the error page shows the status, a plain sentence, and a link home.

## Rules

- Every number that could be compared is tabular and monospaced.
- Status is shown wherever a fact is shown.
- Links are the accent color, underlined on hover only. Buttons never rely on the
  link color: their text uses `accent-ink`.
- No icons from icon fonts; inline SVG only, 16px, stroke 1.5.
- No animation beyond 150ms color transitions.
- Everything works at 360px width without horizontal scroll.
- Both themes, both widths (1280 and 390), every page: run
  `COMPENDIUM_MOCK=1 pnpm dev` and `node apps/web/scripts/check-pages.mjs` before
  any visual change ships. Screenshots land in the scratch folder for a human look.
