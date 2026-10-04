# 12. Design

How the site looks and behaves. Binding for every page; a rebuild (D-0034) starts
from this document, not from the previous code.

## Direction (D-0039)

**An atlas, not a brochure.** Readers come to look something up, usually with the
game open. The site is built around that: a persistent sidebar for moving between
categories, search always one keystroke away, pages that answer in the first screen,
coordinates written the way players type them in-game. The front page still shows
the most interesting finds so it is pleasant to arrive at.

Two registers:

- **World Wiki**: dense and scannable. The key facts of an entity sit in a fact sheet
  at the side; the main column answers "where" first. Trust is one readable sentence.
- **Journal**: lighter and more personal. Big numbers, a timeline, class color.

Light by default, dark theme from the sidebar; the choice is remembered per browser
and follows the system preference until changed.

## Navigation

The sidebar (`Shell`) is the only navigation. Top to bottom:

1. Wordmark (gold book mark, serif name).
2. Search (`/` focuses it; submits to `/wiki?q=`).
3. Game version selector (Classic Era now; other versions listed as "soon").
4. **World**: Zones (`/wiki`), NPCs (`/wiki/npcs`), Creatures (`/wiki/creatures`),
   Areas (`/wiki/areas`). Every world entity type that people look up by name gets
   a category page here; flight paths do not (D-0045), they live on zone pages.
5. **You**: Journal (`/journal`), Add-on (`/sync`).
6. Account (email, sign out, or sign in) and the theme toggle.

On phones (below `lg`, 1024px) the sidebar becomes a drawer behind a menu button in a
slim top bar that also holds the wordmark and a search field. There is no other
menu anywhere.

Entity URLs are unchanged: `/wiki/{flavor}/zone/{id}` and
`/wiki/{flavor}/creature/{id}` (NPCs and creatures share the `creature` entity type;
the page says which it is).

## Tokens

Defined once in `apps/web/src/app.css` as CSS variables per theme and exposed to
Tailwind through `@theme inline`. Pages use only these names, never raw colors.
Every text-on-background pairing must pass WCAG AA (4.5:1 for body text, 3:1 for
large text); `apps/web/scripts/check-pages.mjs` enforces it on every page in both
themes and two widths, and a change is not deployed until it passes.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `bg` | `#f5f3ee` | `#121417` | page background (warm off-white) |
| `surface` | `#ffffff` | `#1a1d22` | cards, sidebar, tables |
| `surface-2` | `#ede9e1` | `#23272e` | active nav item, notes, hover rows |
| `line` / `line-strong` | `#ddd8cd` / `#c9c3b6` | `#30353d` / `#434952` | borders; inputs and hovered cards use the strong one |
| `ink` | `#1c1917` | `#ece9e2` | body text |
| `ink-muted` | `#57534e` | `#b5b0a6` | secondary text |
| `ink-faint` | `#6b6660` | `#948f85` | meta text, table headers (still AA) |
| `accent` / `accent-strong` | `#1e40af` / `#1e3a8a` | `#93b4ff` / `#b7cbff` | links only |
| `gold` on `gold-soft` | `#875606` on `#fdf3d7` | `#f5c451` on `#3a2f10` | wordmark, active nav icon, role chips, Elite/Rare labels |
| `btn` / `btn-hover` / `btn-ink` | `#1c1917` / `#292524` / `#ffffff` | `#ece9e2` / `#ffffff` / `#121417` | primary button |
| `ok` on `ok-soft` | `#166534` on `#dcfce7` | `#86efac` on `#14301f` | confirmed, ingested |
| `warn` on `warn-soft` | `#92400e` on `#fef3c7` | `#fcd34d` on `#3a2a08` | disputed, update available |
| `bad` on `bad-soft` | `#991b1b` on `#fee2e2` | `#fca5a5` on `#3c1414` | errors |
| `info` on `info-soft` | `#1e40af` on `#dbeafe` | `#93c5fd` on `#152a4d` | corrected |

Cards have a 12px radius, a hairline border and a one-pixel shadow. Base element
styles live in Tailwind's `base` layer so utilities always win (N-0018); the dense
table (`.tbl`) and the input (`.field`) are the two component classes.

## Typography

- **Fraunces** (serif, soft axis) for page titles, entity names, zone names on cards
  and the wordmark. **Inter** for everything else. **JetBrains Mono** for numbers,
  coordinates, identifiers and builds (`.num`, `.mono`).
- All three are self-hosted from `apps/web/static/fonts/` (SIL Open Font License),
  latin and latin-ext subsets, so no request leaves for a font service.
- Scale: 12px eyebrows and chips, 13px meta, 14px tables and body in cards, 15px
  body, 17px section headings, 34–40px page titles, 40–52px on the home page.

## Layout

- Sidebar 15.5rem; main column up to 72rem with 16px gutters on phones, 32px from
  `sm`, 48px from `lg`.
- Every page starts with `PageHeader`: an eyebrow (or breadcrumbs), the title, an
  optional one-sentence lede, optional meta line, and a hairline rule.
- Entity pages (zone, NPC/creature) are two columns from `lg`: content left, a sticky
  17rem rail right holding the `Infobox` fact sheet and the `Evidence` card.
- Phones: one column, rail after the content, no horizontal scroll at 360px.

## Components (`apps/web/src/lib/ui/`)

| Component | Role |
|-----------|------|
| `Shell` | sidebar, phone top bar and drawer, footer, theme toggle, `/` shortcut |
| `Icon` | the inline SVG icon set, 24-unit, stroke 1.75 |
| `PageHeader` | eyebrow or breadcrumbs, title, lede, meta, optional right-side slot |
| `Infobox` | fact sheet: label/value rows, empty values skipped, optional links |
| `Evidence` | the trust sentence with a check, clock or alert glyph |
| `Chip` | small label: gold for roles, ok/warn/bad/info for states |
| `Card` | surface with optional uppercase title |
| `StatTile` | big mono number with a label (Journal) |
| `UnitList` | the NPC/creature table: name, level, type, where (zone and coordinates) |
| `MapImage` | a composed zone map at its true aspect ratio, with optional pins drawn in map units (0.45% of the map width, a little larger with sightings) so they scale with the map and stay on the exact spot |
| `CategoryToolbar` | filter by name, type and sort for category pages (plain GET form) |
| `UnitCategoryPage` | the NPCs and Creatures pages, parameterised by kind |
| `Button` | primary (ink), secondary (outline), quiet (text) |
| `Empty` | dashed empty state with a one-line hint and a call to action |

Components take data, never fetch. Pages fetch in `+page.server.ts`; shared loaders
live in `src/lib/server/wiki-lists.ts` and `category-load.ts`.

## Page patterns

- **Home**: eyebrow, serif headline, one sentence on where the data comes from, a
  large search box, a muted count line; then Zones (cards with continent and unit
  count, most-seen first), Notable finds (rares, elites, bosses), Recently seen
  (table with kind, level, zone), and a "Add what you see" card with three steps and
  the add-on button.
- **Zones** (`/wiki`): every zone of the build (D-0045) as cards grouped by
  continent, the continent name linking to its own map page; a card shows unit
  and area counts, or "Nothing recorded here yet". With `?q=`, the same page shows search results grouped by
  category and an empty state that explains names match as typed in-game.
- **NPCs / Creatures**: toolbar (name filter, type, sort) and the `UnitList` table.
  NPCs and Creatures are always separate pages, never one list with a tag (D-0038).
- **Areas**: name filter and a table with the zone.
- **Zone**: breadcrumbs (Zones / continent / zone), title, section chips with counts
  that jump to NPCs, Creatures, Areas, Flight paths. The zone map (`MapImage`) is
  the first thing on the page, full width. The only marks on it are flight masters
  (dark diamonds with a gold edge, D-0045); nothing else is drawn and there is no
  switch (D-0040). Tables show coordinates within this zone. The Flight paths
  section is one card per flight master: node name, the flight master's name
  linking to their page, coordinates, and destination chips linking to zones.
  Rail: About (kind, part of, counts, map ID) and Evidence, or "No one has
  recorded this zone yet" for a map only the client tables know.
- **NPC / Creature**: breadcrumbs (category / home zone / name), serif name,
  `<subtitle>`, level with Elite/Rare in gold, type and family, role chips. Main:
  "Where to find them/it" (zone, up to six coordinate spots most-seen first,
  sightings), Health by level, and "Every recorded fact" collapsed. When map art
  exists, a map of the home zone with this entity's spots marked (gold dots, larger
  with more sightings) sits above the location table; this is the only place pins
  are drawn (D-0040). Rail: fact
  sheet titled NPC or Creature, then Evidence with the observation count.
- **Journal index**: character cards with a class-tinted initial, level, race,
  class, realm, last seen.
- **Journal character**: breadcrumbs, class dot and meta line, stat tiles (played,
  areas explored, flight paths known, deaths, sessions), timeline grouped by day
  with gold glyphs; in the rail: zones visited, flight paths known, sessions,
  privacy.
- **Add-on** (`/sync`): a vertical checklist of four cards (Connect folder, Install,
  Play then log out, Sync); the current step has an ink number, done steps a green
  check, later steps are faint. Per-client rows under Install; results under Sync;
  recent uploads table below.
- **Account / Sign in / Errors**: single narrow column with `PageHeader` and one or
  two cards. The 404 says "Not on any map we have."
- **Admin** (owners and admins only, linked from the sidebar): maintenance cards
  with a count, a button, and a log. First card: compose pending zone maps.

## Rules

- Every number that could be compared is tabular and monospaced.
- Coordinates are shown as the game shows them, "47, 60", out of 100.
- Trust status is a sentence on the entity page (`Evidence`); lists never show it.
- Links are the accent color, underlined on hover only. Buttons never rely on the
  link color.
- Gold is a mark, not a text color for body copy.
- Icons are inline SVG from `Icon`; no icon fonts, no emoji.
- No animation beyond 150ms color transitions and a 2px arrow nudge on card hover.
- Separators between inline items are explicit `·` spans with margins (Svelte trims
  whitespace at block edges, so a bare space inside `{#if}` disappears).
- Everything works at 360px width without horizontal scroll.
- Both themes, both widths (1280 and 390), every page: run
  `COMPENDIUM_MOCK=1 pnpm dev --port 5173` and `node apps/web/scripts/check-pages.mjs`
  before any visual change ships, then look at the screenshots. A page that passes
  the audit but reads badly has not passed.
