# Win-Win Approach

A discussion platform for socioeconomic issues, following the pipeline:
**Information → Discussion → Research → Modelling → Real-World Projects**.

This repository is governed by [`CLAUDE.md`](./CLAUDE.md) — read it before
making changes. All feature work is tracked as specs under
[`/specs`](./specs/README.md).

## Current state

This is spec `0001-project-scaffold`: a working Next.js app skeleton and the
full quality-gate pipeline (lint, typecheck, unit tests, e2e tests, build,
CI). There is no database, auth, or real content yet — the home page is a
placeholder.

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript (`strict: true`)
- [Tailwind CSS](https://tailwindcss.com/)
- [ESLint](https://eslint.org/) (`typescript-eslint` + `next/core-web-vitals`)
  - [Prettier](https://prettier.io/) (via `eslint-config-prettier`, so the two
    never disagree)
- [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged)
  for a pre-commit lint/format pass on staged files
- [Vitest](https://vitest.dev/) for unit/integration tests
- [Playwright](https://playwright.dev/) for end-to-end tests
- [GitHub Actions](https://github.com/features/actions) for CI

See `CLAUDE.md` section 2 for the full pinned stack (including pieces not
installed yet, e.g. Prisma/Auth.js, which arrive in later specs).

## Prerequisites

- Node.js 24.x (the repo was built and verified against Node v24.11.1) and
  npm 11.x
- Git

## Setup

```bash
# 1. Clone and enter the repo
git clone <this-repo-url>
cd win-win-approach

# 2. Install dependencies (this also installs the Husky git hook via the
#    "prepare" script)
npm install

# 3. Copy the env template. Nothing is required yet at this stage, but this
#    establishes the convention for later specs (DB, auth, etc.).
cp .env.example .env.local

# 4. (First time only) install the Playwright browser used by the e2e tests
npx playwright install chromium
```

## Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the
"Win-Win Approach" placeholder page.

## Quality gates

These are the same commands CI runs on every push and pull request
(`.github/workflows/ci.yml`). All must pass before a PR is mergeable
(see `CLAUDE.md` section 4):

```bash
npm run lint        # ESLint — zero errors/warnings
npm run typecheck    # tsc --noEmit (runs `next typegen` first)
npm run test         # Vitest unit/integration tests
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
/lib                  Server-side helpers (empty for now)
/tests                Vitest unit/integration tests (mirrors /app, /lib)
/e2e                  Playwright end-to-end tests
/specs                Spec backlog/active/done — see specs/README.md
/.github/workflows    CI pipelines
```

## Git hooks

A pre-commit hook (via Husky) runs `lint-staged`, which lints and formats
only the files you've staged. If it modifies files, re-stage and commit
again.
