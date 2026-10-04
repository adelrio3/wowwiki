# 12. Design

How the site looks and behaves. Binding for every page; a rebuild (D-0034) starts
from this document, not from the previous code.

## Direction (D-0035)

**An archive, not a game interface.** The site is a serious reference work about a
game world, written by the world itself. It should feel like a well-set book or a
good museum catalogue: quiet surfaces, warm paper-and-gold tones, strong typography,
generous but purposeful spacing, dense where the data is dense. No faux-medieval
textures, no gilded frames, no glowing buttons, no imitation of Blizzard's UI.

Two registers:

- **World Wiki**: dense and scannable. The key facts of an entity are readable in
  two seconds at the top; detail tables sit below. Status is always visible.
- **Journal**: lighter and more visual. Big numbers, a timeline, a map. It is for
  enjoyment, so it may breathe.

Dark by default, light theme available from the header; the choice is remembered
per browser and follows the system preference until changed.

## Tokens

Defined once in `apps/web/src/app.css` as CSS variables per theme and exposed to
Tailwind through `@theme inline`. Pages use only these names, never raw colors.

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `bg` | `#141210` | `#f6f1e7` | page background |
| `surface` | `#1b1815` | `#fffdf8` | cards, header |
| `surface-2` | `#242019` | `#efe7d8` | table stripes, inputs, hover |
| `line` | `#332c24` | `#dcd1bf` | borders, rules |
| `ink` | `#efe7da` | `#1e1913` | body text |
| `ink-muted` | `#a79c8b` | `#6a6154` | secondary text |
| `ink-faint` | `#6f6555` | `#9a8f80` | placeholders, meta |
| `gold` | `#dcb257` | `#8d6210` | accent, links, primary button |
| `gold-strong` | `#f0c86c` | `#6f4c0a` | link hover, emphasis |
| `ok` | `#86c492` | `#2f7a3f` | confirmed |
| `warn` | `#e0aa5a` | `#9a6a12` | disputed |
| `bad` | `#e2796a` | `#b3392a` | errors, failed |
| `info` | `#86b6dc` | `#2c6a9a` | corrected, notices |

Status badge colors: unconfirmed uses `ink-muted` on `line`; confirmed `ok`;
disputed `warn`; retired `ink-faint`; corrected `info`.

## Typography

- Display: **Fraunces** (variable serif) for the site name, page titles, and section
  headings. Optical size on, slight negative tracking on large sizes.
- Text: **Inter** for everything else.
- Numbers and identifiers: **JetBrains Mono** in tables, coordinates, builds, IDs.
- Scale: 13px meta, 14px tables, 16px body, 20px section, 28px page title (36px on
  the home page). Line height 1.5 body, 1.2 headings.

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
| `Shell` | header, nav, search, theme toggle, footer |
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
- Links are gold, underlined on hover only.
- No icons from icon fonts; inline SVG only, 16px, stroke 1.5.
- No animation beyond 150ms color transitions.
- Everything works at 360px width without horizontal scroll.
- Light theme is tested on every page change, not retrofitted.
