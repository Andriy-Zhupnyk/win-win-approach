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
  account through the UI to log in (or run `npm run db:seed:demo` with
  `DEMO_ACCOUNTS_PASSWORD` set to give the member and expert a login).
- two Information versions: an archived "GS 0.1" and the published "GS 0.2".
  It also repairs the fixture if an admin published another version since
  the last seed.

**The e2e tests need this seed**: the Information and home page tests read
the published "GS 0.2" version. Run `npm run db:seed` before
`npm run test:e2e` on a fresh database (CI does this too).

The hosted demo is described in "Deploying the demo" below. Two opt-in owner
scripts exist for it (`npm run admin:create`, `npm run db:seed:demo`); the
plain `db:seed` still creates no passwords.

## Deploying the demo

The public demo runs on [Vercel](https://vercel.com/) (app) and
[Neon](https://neon.tech/) (PostgreSQL). Agents only prepare the repository;
**a human creates the Neon and Vercel projects and types the administrator
password**. The password must never be sent in chat, committed, put in an
issue/PR, or passed on a command line.

### Environment variables

Names are listed in `.env.example` (no values). On Vercel set them in the
dashboard, **Production scope only**:

| Variable       | Value                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Neon **pooled** string (host has `-pooler`) plus `?sslmode=require&pgbouncer=true`            |
| `AUTH_SECRET`  | a fresh secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

`AUTH_TRUST_HOST` and `AUTH_URL` are **not** needed on Vercel: Auth.js (via
`@auth/core`) enables `trustHost` automatically when the `VERCEL` variable is
present. (Behind any other host, set `AUTH_TRUST_HOST=true`.)

### Where migrations run

`prisma migrate deploy` is a **manual step run from the owner's machine**, not
part of the Vercel build. Reasons: a build that mutates the database would also
do so for every preview and failed build; migrations need Neon's **direct**
(non-pooled) connection because they take advisory locks, which PgBouncer's
pooled connection does not support; and a schema change should be a deliberate
act, ordered before the deploy that needs it. The Vercel build only runs
`prisma generate` (via `postinstall`) and `next build`.

### Preview deployments

Previews are **disabled**: `vercel.json` has an `ignoreCommand` that skips every
build whose `VERCEL_ENV` is not `production`, so a PR never gets a preview
that could touch the demo database. In addition, never add `DATABASE_URL` or
`AUTH_SECRET` to the Vercel _Preview_ or _Development_ scopes. If previews are
wanted later, give them their own Neon branch and a Preview-scoped
`DATABASE_URL` pointing at it, and remove the `ignoreCommand`.

### First deploy

1. Create the Neon project. Copy both connection strings (pooled and direct)
   into your password manager.
2. Create the Vercel project from the GitHub repository (framework: Next.js,
   production branch: `main`) and set the two variables above in Production.
3. Migrate the hosted database, from a local shell with the **direct** URL.
   Read it without echo so it does not enter shell history:

   ```bash
   read -rs DATABASE_URL && export DATABASE_URL   # paste the direct URL, Enter
   npx prisma migrate deploy
   ```

   PowerShell: `$env:DATABASE_URL = Read-Host -MaskInput "direct URL"`
   (PowerShell 7) and then `npx prisma migrate deploy`.

4. (Optional) load the sample Information content in the same shell:
   `npm run db:seed`. It also inserts a placeholder `admin@winwinapproach.org`
   row that has no password and therefore cannot sign in. Skip it to start with
   an empty Information page and create content in the admin panel instead.
5. Create the administrator, still in the same shell (an interactive terminal
   is required; in Git Bash on Windows prefix with `winpty`, or use PowerShell):

   ```bash
   npm run admin:create -- <administrator-email>
   ```

   The script requires `DATABASE_URL` to be exported (it does not read `.env`
   files), prints the database host it will modify, asks you to type `yes`,
   then asks for the password twice at a hidden prompt (minimum 12
   characters). The email may also come from `ADMIN_EMAIL` or the prompt. It
   creates the user, or updates an existing one to `ADMIN` and replaces its
   password. The password is never printed, logged or stored (only its bcrypt
   hash, same cost as registration).

6. (Optional) demo logins for the member and expert roles, same shell:

   ```bash
   read -rs DEMO_ACCOUNTS_PASSWORD && export DEMO_ACCOUNTS_PASSWORD
   npm run db:seed:demo
   ```

   This sets the password of `member@winwinapproach.org` and
   `expert@winwinapproach.org` (creating them if absent). It refuses to run
   without `DEMO_ACCOUNTS_PASSWORD` and never creates or changes an
   `ADMIN`; it aborts if either email already belongs to an administrator.

7. Trigger a Vercel production deploy (push to `main`, or redeploy from the
   dashboard) and run the smoke test below.

Close the shell (or `unset DATABASE_URL DEMO_ACCOUNTS_PASSWORD`) afterwards.

No role is ever granted from an email address: public registration always
creates a `MEMBER` (there is no email verification), and administrators exist
only through `npm run admin:create`.

### Later releases

Deploys happen on push to `main`. When a release contains a new migration,
run `npx prisma migrate deploy` with the direct URL **before** merging it.

### Rotating secrets

- `AUTH_SECRET`: set a new value in Vercel (Production) and redeploy. All
  sessions are invalidated; users log in again.
- Administrator password: run `npm run admin:create -- <email>` again; it
  replaces the password of the existing account.
- Demo password: export a new `DEMO_ACCOUNTS_PASSWORD` and re-run
  `npm run db:seed:demo`.
- Database password: reset the role password in Neon, then update `DATABASE_URL`
  in Vercel and redeploy.

### Tear down

Delete the Vercel project, then the Neon project (this destroys all data,
including registered users' emails and password hashes). To delete a single
user on request, remove their row in Neon's SQL editor or Prisma Studio.

### Smoke test of the deployed site

Manual checklist, on the public URL (a Playwright run against production is
deliberately not provided, since it would write test data to the demo
database):

- [ ] `/uk/register` and `/en/register` show the privacy notice.
- [ ] Register a new account, then log in; the display name appears in the nav.
- [ ] Create a discussion thread and post a reply.
- [ ] Open the Information page and its version history, including an
      archived version.
- [ ] As a member, submit a proposal; it appears in the proposals list.
- [ ] Log in as the administrator, review the proposal, publish a version; the
      Information page shows the new version.
- [ ] Log out; protected pages redirect to login.

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
