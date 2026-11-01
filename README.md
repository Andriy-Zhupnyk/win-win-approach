# Win-Win Approach

A discussion platform for socioeconomic issues, following the pipeline:
**Information → Discussion → Research → Modelling → Real-World Projects**.

This repository is governed by [`CLAUDE.md`](./CLAUDE.md) — read it before
making changes. All feature work is tracked as specs under
[`/specs`](./specs/README.md).

## Current state

The MVP scope (the _Information_ and _Discussion_ stages) is built; specs
0001–0011 are done (see `specs/done/`):

- public Information page with version history and archived versions
- auth with roles (`visitor`, `member`, `expert`, `administrator`) and a
  personal account area
- admin panel to manage Information content
- discussion threads and replies
- proposals to change the Information content, reviewed by admins
- Ukrainian and English UI (`next-intl`)

Research, Modelling and Real-World Projects are future stages and are not
built.

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript (`strict: true`)
- [Tailwind CSS](https://tailwindcss.com/)
- [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://www.prisma.io/)
  (see "Database (local development)" below)
- [ESLint](https://eslint.org/) (`typescript-eslint` + `next/core-web-vitals`)
  - [Prettier](https://prettier.io/) (via `eslint-config-prettier`, so the two
    never disagree)
- [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged)
  for a pre-commit lint/format pass on staged files
- [Vitest](https://vitest.dev/) for unit/integration tests
- [Playwright](https://playwright.dev/) for end-to-end tests
- [GitHub Actions](https://github.com/features/actions) for CI

Also: [Auth.js](https://authjs.dev/) (NextAuth v5) with the Prisma adapter and
[next-intl](https://next-intl.dev/). See `CLAUDE.md` section 2 for the full
pinned stack.

## Prerequisites

- Node.js 24.x (the repo was built and verified against Node v24.11.1) and
  npm 11.x
- Git
- [Docker](https://www.docker.com/) (for a local Postgres database — see
  below)

## Setup

```bash
# 1. Clone and enter the repo
git clone <this-repo-url>
cd win-win-approach

# 2. Install dependencies from the lockfile (this also installs the Husky git
#    hook via the "prepare" script, and generates the Prisma client via
#    "postinstall"). Use `npm ci`, never plain `npm install`: see CLAUDE.md
#    section 4.1 (lockfile hygiene).
npm ci

# 3. Copy the env template, fill in AUTH_SECRET (see .env.example), and start
#    a local database (see next section)
cp .env.example .env.local
docker compose up -d

# 4. Apply migrations and seed fixture data
npx prisma migrate dev
npm run db:seed

# 5. (First time only) install the Playwright browser used by the e2e tests
npx playwright install chromium
```

## Database (local development)

This project uses PostgreSQL via Prisma. Since there's no hosted Postgres
account available in every environment this repo is developed in, local
development and tests run against a local **Docker** Postgres instead of a
hosted one:

```bash
# Start a local postgres:16 container (see docker-compose.yml)
docker compose up -d

# Stop it (data persists in the winwin-postgres-data volume)
docker compose down

# Stop it AND wipe all local data (useful to test a migration from scratch)
docker compose down -v
```

`.env.example` documents the matching `DATABASE_URL` for this container.
Copy it to `.env.local` (gitignored) — Prisma's CLI (via `prisma.config.ts`)
and the Vitest test setup both load `.env.local` directly.

Useful commands once the container is running:

```bash
npx prisma migrate dev   # create/apply a migration from schema.prisma changes
npm run db:seed          # populate fixture data (see below)
npx prisma studio         # browse the database in a GUI
```

`npm run db:seed` is idempotent. It creates:

- three users: `admin@winwinapproach.org` (administrator),
  `member@winwinapproach.org` (member) and `expert@winwinapproach.org`
  (expert). They have no password, so they cannot sign in; register an
  account through the UI to log in.
- two Information versions: an archived "GS 0.1" and the published "GS 0.2".
  It also repairs the fixture if an admin published another version since
  the last seed.

**The e2e tests need this seed**: the Information and home page tests read
the published "GS 0.2" version. Run `npm run db:seed` before
`npm run test:e2e` on a fresh database (CI does this too).

For a production/demo deployment, `DATABASE_URL` will instead point at a
hosted Postgres instance (e.g. [Neon](https://neon.tech/), per `CLAUDE.md`)
— that's a deployment-time decision for a later spec, not something this
repo configures today.

## Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000); it redirects to a
locale (`/uk` or `/en`) and shows the current Information page.

## Quality gates

These are the same commands CI runs on every push and pull request
(`.github/workflows/ci.yml`). All must pass before a PR is mergeable
(see `CLAUDE.md` section 4). `npm run test` includes Prisma integration
tests and needs a running, migrated local Postgres (`docker compose up -d` and `npx prisma migrate dev`); CI provides this via a
`postgres:16` service container instead.

```bash
npm run lint        # ESLint — zero errors/warnings
npm run typecheck    # tsc --noEmit (runs `next typegen` first)
npm run test         # Vitest unit/integration tests (needs DATABASE_URL)
npm run test:e2e     # Playwright e2e tests (builds and starts its own server)
npm run build        # production build
```

`npm run verify` runs lint, typecheck, test and build in order, stops at the
first failure and prints a one-line result per step. It does not run e2e.

`npm run test:e2e` needs the seeded database (see above) and the Playwright
browser (`npx playwright install chromium`). It runs against a production
build (`next build && next start` on port 3100), not `next dev`, so the
first request to each route is not slowed by on-demand compilation. It
always starts its own server: stop anything already listening on port 3100.

Dependencies and GitHub steps have dedicated scripts (see `CLAUDE.md`
sections 4.1 and 9 for the rules; they are not repeated here):

```bash
npm run deps:add -- <pkg...>     # add a dependency, keeping the lockfile Linux-safe
npm run deps:remove -- <pkg...>  # remove a dependency
npm run deps:verify              # Linux `npm ci` against the current lockfile
node scripts/gh-flow.mjs pr-create | ci-wait | merge-close   # PR/CI/merge steps
```

Other useful scripts:

```bash
npm run format        # Prettier --write .
npm run format:check  # Prettier --check . (CI does not currently gate on this)
npm run test:watch    # Vitest in watch mode
```

## Project layout

```
/app                  Next.js App Router routes
/components           Shared UI components
/lib                  Server-side helpers (auth, rbac, prisma client, etc.)
/messages             uk.json, en.json (next-intl)
/scripts              Harness scripts (verify, deps, gh-flow, hooks)
/prisma               schema.prisma, migrations/, seed.ts
/tests                Vitest unit/integration tests (mirrors /app, /lib)
/e2e                  Playwright end-to-end tests
/specs                Spec backlog/active/done — see specs/README.md
/.github/workflows    CI pipelines
docker-compose.yml    Local Postgres for development/tests
prisma.config.ts       Prisma CLI config (loads .env.local, seed command)
```

## Git hooks

A pre-commit hook (via Husky) runs `lint-staged`, which lints and formats
only the files you've staged. If it modifies files, re-stage and commit
again.
