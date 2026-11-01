# 0013 — Logout must not be undone by in-flight requests

**Status:** Backlog
**Depends on:** 0003, 0012

## Context / why

While stabilizing the e2e suite (spec 0012) the logout step of
`e2e/auth.spec.ts` failed intermittently against a production build: after
logout, `/account` still rendered. The observed explanation, recorded in a
comment in that test: the nav-link RSC prefetches each render with the old
session and **re-issue the session cookie**, so a prefetch still in flight when
logout clears the cookie can write it back. The test currently works around it
with `waitForLoadState("networkidle")` before clicking logout, which hides the
behavior rather than fixing it.

If real, this is not only a test problem: a user who clicks "Log out" while
background prefetches are running can end up still signed in (the page looks
logged out, the cookie is back). That is a security-relevant defect in a
session-handling path, so it should be understood and fixed deliberately.

What is known and what is not: the symptom was observed in e2e; the **exact
source of the cookie re-issue has not been verified**. Candidates are the
`auth(...)` wrapper in `middleware.ts` (runs on every page path, including
prefetch requests) and `auth()` in `components/site-nav.tsx` (Server Components
normally cannot set cookies, so this is the less likely one). The spec starts by
finding out.

## Scope

1. **Reproduce deterministically.** A Playwright test (no `networkidle`
   workaround) that triggers logout while a prefetch of an authenticated route
   is still in flight, and fails today against a production build. Record in the
   PR how it was made deterministic (e.g. delaying the prefetch response with
   `page.route`).
2. **Find the source** of the re-issued cookie (middleware vs. server
   component vs. something else) and state it in the PR with evidence (the
   `Set-Cookie` on the prefetch response).
3. **Fix it at the source**, keeping auth behavior otherwise unchanged. Options
   to weigh (the implementer picks, with reasons in the PR): do not refresh the
   session cookie for prefetch/RSC requests; stop prefetching authenticated
   links from the nav; or make the cookie refresh not resurrect a cleared
   session. Do not weaken any RBAC or session check to make the test pass.
4. **Remove the `networkidle` workaround** from `e2e/auth.spec.ts` (and its
   explanatory comment) once the fix makes it unnecessary.

## Non-goals

- No switch to database sessions, no server-side token revocation list and no
  change to session lifetime: JWT sessions stay as decided in spec 0003 (a
  separate spec if stronger logout semantics are wanted).
- No new auth features, roles or providers.
- No changes to the login/register flows beyond what the fix requires.

## Data model changes

None.

## User-facing behavior

Logging out always ends the session, even if background requests are still
running. No visible change otherwise.

## i18n

None.

## Acceptance criteria

- [ ] A deterministic test reproduces the bug before the fix and passes after
      it; the PR shows both results.
- [ ] The PR identifies the source of the cookie re-issue with evidence.
- [ ] `e2e/auth.spec.ts` no longer needs `waitForLoadState("networkidle")`
      before logout, and the e2e suite passes three consecutive cold-start runs
      with `--retries=0` locally.
- [ ] Authenticated routes still redirect visitors to login and `/admin` still
      rejects non-admins (existing tests keep passing).
- [ ] `npm run verify` passes; CI is green, including e2e.

## Test plan

- Playwright: the new deterministic logout-race test, plus the existing
  `auth.spec.ts` flow without the `networkidle` workaround.
- Vitest: only if the fix introduces logic that can be tested in isolation
  (e.g. a request classifier for prefetch/RSC requests).
- Manual: inspect `Set-Cookie` headers on a prefetch response before and after
  the fix.
