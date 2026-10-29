# Win-Win Approach

A discussion platform for socioeconomic issues, following the pipeline:
**Information → Discussion → Research → Modelling → Real-World Projects**.

This repository is governed by [`CLAUDE.md`](./CLAUDE.md) — read it before
making changes. All feature work is tracked as specs under
[`/specs`](./specs/README.md).

## Current state

Spec `0001-project-scaffold` (the Next.js app skeleton and quality-gate
pipeline) and spec `0002-core-domain-model` (the Prisma schema, migration,
and seed data) are done. There is no auth or UI for this data yet — the
home page is still a placeholder.

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

See `CLAUDE.md` section 2 for the full pinned stack (including pieces not
installed yet, e.g. Auth.js, which arrives in a later spec).

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

# 2. Install dependencies (this also installs the Husky git hook via the
#    "prepare" script, and generates the Prisma client via "postinstall")
npm install

# 3. Copy the env template and start a local database (see next section)
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
npm run db:seed          # populate fixture data (admin/member/expert users,
                          # one published "GS 0.1" InformationVersion)
npx prisma studio         # browse the database in a GUI
```

For a production/demo deployment, `DATABASE_URL` will instead point at a
hosted Postgres instance (e.g. [Neon](https://neon.tech/), per `CLAUDE.md`)
— that's a deployment-time decision for a later spec, not something this
repo configures today.

## Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the
"Win-Win Approach" placeholder page.

## Quality gates

These are the same commands CI runs on every push and pull request
(`.github/workflows/ci.yml`). All must pass before a PR is mergeable
(see `CLAUDE.md` section 4). `npm run test` includes Prisma integration
tests and needs a running, migrated local Postgres (`docker compose up -d`

- `npx prisma migrate dev`) — CI provides this via a `postgres:16` service
  container instead.

```bash
npm run lint        # ESLint — zero errors/warnings
npm run typecheck    # tsc --noEmit (runs `next typegen` first)
npm run test         # Vitest unit/integration tests (needs DATABASE_URL)
npm run test:e2e     # Playwright e2e tests (starts its own dev server)
npm run build        # production build
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
/components           Shared UI components (empty for now)
/lib                  Server-side helpers (Prisma client singleton, etc.)
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
