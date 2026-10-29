# 0001 — Project scaffold & quality gates

**Status:** Done (merged in #1)
**Depends on:** —

## Context / why

Before any feature code exists, the repo needs a working Next.js app skeleton
and the full quality-gate pipeline (lint, typecheck, test, CI) running green
on an empty app. Every later spec builds on top of this; getting it wrong
here is expensive to fix later.

## Scope

- `create-next-app` with App Router, TypeScript strict, Tailwind CSS.
- ESLint (typescript-eslint + next/core-web-vitals config) + Prettier,
  configured to not conflict with each other.
- Husky + lint-staged: pre-commit runs lint + format on staged files.
- Vitest configured for unit/integration tests (`npm run test`), with one
  trivial passing test as a smoke check.
- Playwright configured for e2e (`npm run test:e2e`), with one trivial test
  that loads the home page and asserts it renders.
- `npm run typecheck` script (`tsc --noEmit`).
- GitHub Actions workflow (`.github/workflows/ci.yml`) running, on every
  push and PR: install → lint → typecheck → test → build. Playwright job can
  be a separate CI job.
- `.env.example` documenting required env var names (no values).
- Base folder layout per `CLAUDE.md` section 8 (`/app`, `/components`,
  `/lib`, `/tests`, `/e2e`), even if mostly empty placeholders at this stage.
- README.md with setup instructions (install, env setup, dev server, test
  commands).

## Non-goals

- No database, no Prisma, no auth, no real pages/content — that's 0002+.
- No deployment configuration beyond what's needed for CI to pass (Vercel
  hookup can happen once there's something worth deploying).

## Data model changes

None.

## User-facing behavior

None yet — this is infrastructure only. A single placeholder home page is
acceptable (e.g. "Win-Win Approach — coming soon") just so the app renders.

## i18n

None yet (see 0004).

## Acceptance criteria

- [ ] `npm run lint` passes with zero errors/warnings on a fresh clone.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes (smoke test included).
- [ ] `npm run test:e2e` passes locally.
- [ ] `npm run build` succeeds.
- [ ] GitHub Actions CI is green on the PR for this spec.
- [ ] A fresh `git clone` + documented setup steps in README get a
      contributor to a running `npm run dev` with no undocumented steps.

## Test plan

One Vitest smoke test, one Playwright smoke test, verified via CI.
