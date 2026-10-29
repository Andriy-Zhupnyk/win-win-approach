# 0003 — Auth & RBAC

**Status:** Backlog
**Depends on:** 0001, 0002

## Context / why

The site must be readable without an account, but registration/login and
role-based access (`member`, `expert`, `administrator`) gate everything else
(account area, admin panel, proposals).

## Scope

- Auth.js (NextAuth v5) with the Prisma adapter, using the `User` model from
  0002.
- Credentials provider (email + password) is sufficient for the MVP/demo;
  OAuth providers are optional nice-to-have, not required.
- Registration flow: new users are created with role `MEMBER` by default.
  `visitor` is simply "not logged in" — not a stored role.
- Session contains the user's role.
- A single centralized authorization helper (e.g. `lib/rbac.ts`) exposing
  something like `requireRole(session, ["ADMIN"])` / `can(session, action)`,
  used by every server action/route that needs a role check. No inline
  `if (user.role === "ADMIN")` scattered across the codebase.
- Middleware (`middleware.ts`) protecting `/account` and `/admin` route
  groups at the edge (redirect to login if unauthenticated; redirect to a
  "forbidden" page if authenticated but wrong role) — this is in addition
  to, not instead of, server-side checks in the action/route itself (don't
  rely on middleware alone for authorization).
- Login/logout/register UI pages (plain, unstyled-is-fine-for-now forms are
  OK; this spec is about correctness, not visual design).

## Non-goals

- No password reset / email verification flow — note it as a future spec if
  needed for the demo, but it's not required for MVP.
- No fine-grained permissions system (e.g. per-resource ACLs) — four roles
  with a flat capability set is enough for now.

## Data model changes

None beyond what 0002 already defined (reuses `User.role`).

## User-facing behavior

- Visitor can register and log in.
- Logged-in user sees their role-appropriate navigation (e.g. no "Admin"
  link for non-admins).
- Attempting to access `/admin` as a non-admin redirects to a clear
  "forbidden" message, not a crash or silent no-op.

## i18n

Keys for: register/login/logout form labels and errors, "forbidden" page
copy. Add to both `uk.json` and `en.json`.

## Acceptance criteria

- [ ] A visitor can register, creating a `MEMBER` user.
- [ ] A registered user can log in and log out.
- [ ] `requireRole`/`can` helper exists and is the only place role checks
      are implemented; grep confirms no duplicate inline role checks in
      server actions/routes.
- [ ] `/admin` is inaccessible (redirect, not error) to `VISITOR`/`MEMBER`/
      `EXPERT`.
- [ ] `/account` is inaccessible to an unauthenticated visitor.
- [ ] Session/JWT includes role and survives a page reload.

## Test plan

Vitest unit tests for `requireRole`/`can` covering each role × each gated
action. Playwright e2e: register → login → attempt `/admin` as member (
redirected) → logout.
