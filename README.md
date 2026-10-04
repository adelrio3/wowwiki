# WoW Compendium

A public wiki of World of Warcraft built only from what real players' game clients saw,
captured by our own silent add-on, plus a private Journal of each player's own journey
with progress tracking and achievements.

- Design documents live in [`docs/`](docs/). Start with
  [`docs/00-vision-and-scope.md`](docs/00-vision-and-scope.md).
- AI coding sessions must read [`CLAUDE.md`](CLAUDE.md) first.
- Status: Phase 1, version 0.1.0. Add-on, parser, sync, database, and the first wiki
  and Journal pages exist; see `docs/08-roadmap.md`.

## Working on it

```
pnpm install          # once
pnpm test             # TypeScript tests (packages and app)
pnpm test:lua         # add-on tests against the mocked client
pnpm build            # production build of the site (also packages the add-on)
pnpm dev              # local dev server
```

Database: `supabase/migrations/`, applied through the Supabase SQL editor (see
`supabase/README.md`). The site needs `SUPABASE_SERVICE_ROLE_KEY` in its environment.

World of Warcraft and all related content are the property of Blizzard Entertainment.
This is an unaffiliated fan project.
