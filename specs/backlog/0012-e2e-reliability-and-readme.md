# 0012 — E2E reliability and README refresh

**Status:** Backlog
**Depends on:** 0009, 0010

## Context / why

Two small, related problems around running the app and its e2e tests locally:

- `e2e/account.spec.ts` and `e2e/auth.spec.ts` failed on a cold `next dev`
  server without retries and passed with them (observed during spec 0007; CI
  hides it with `retries: 2`). The likely cause is the first request to each
  route compiling on demand and exceeding Playwright's default timeouts, but
  this is a hypothesis to verify, not a given. Flaky tests erode trust in CI,
  hide real failures behind retries and slow every run; each new e2e test adds
  to it.
- `README.md` is stale: "Current state" still says only specs 0001 and 0002
  exist and the home page is a placeholder, setup uses `npm install` (which
  `CLAUDE.md` §4.1 forbids for lockfile hygiene), and the seed description
  does not match what `prisma/seed.ts` creates now. Local e2e also needs
  `npm run db:seed` first, which nowhere says so.

## Scope

1. **Diagnose** the flakiness: run the full Playwright suite several times
   from a cold start with `--retries=0`, record which tests fail and why
   (timeouts, hydration, ordering/shared data), and state the root cause in
   the PR.
2. **Fix the root cause** within e2e configuration and test code (typical
   candidates: run the suite against a production build via
   `next build && next start` instead of `next dev`, warm up the routes
   before the tests, or targeted timeout/wait fixes). Pick by measurement; do
   not just raise global timeouts or add more retries.
3. **README refresh:** current state (all MVP specs done), setup with
   `npm ci`, what `db:seed` creates today, that local e2e needs the seed, and
   pointers to `npm run verify`, the `deps:*` scripts and `scripts/gh-flow.mjs`
   (link to `CLAUDE.md` instead of duplicating its rules).

## Non-goals

- No Playwright browser caching or other CI speed work beyond what the fix
  needs (a separate spec if CI time becomes a concern, as in 0010).
- No new e2e tests, no changes to application code.
- No removal of `retries: 2` in CI unless the measurements justify it; if
  they do, say so in the PR.

## Data model changes

None.

## User-facing behavior

None. Development tooling and docs only.

## i18n

None.

## Acceptance criteria

- [ ] The PR documents the root cause of the flakiness, backed by the
      cold-start runs with `--retries=0`.
- [ ] After the fix, the full e2e suite passes three consecutive times from a
      cold start with `--retries=0` locally.
- [ ] CI e2e is green.
- [ ] `README.md` reflects the current state, uses `npm ci`, describes the
      seed correctly and mentions the seed requirement for e2e.
- [ ] No application source code changed; `npm run verify` passes.

## Test plan

- Manual: repeated cold-start runs of `npm run test:e2e` with `--retries=0`,
  before and after the fix, results summarized in the PR.
- CI: the existing e2e job must pass.
