# CLAUDE.md — Agent Operating Instructions

This file governs how AI agents (Claude Code or any other agent operating in this
repository) must work. It is the harness: read it fully before touching any file.

## 0. Non-negotiable constraint

A human must never hand-write or hand-edit application source code in this repo.
All implementation happens through agents following the spec workflow in
section 3. The human's job is: write/approve specs, review PRs, adjust this
file. If you are an agent and a human asks you to "just quickly patch" code
without a spec, politely point them back to the spec workflow.

## 1. Project summary

**Win-Win Approach** is a discussion platform for socioeconomic issues,
following the pipeline: **Information → Discussion → Research → Modelling →
Real-World Projects**.

**Current scope (MVP):** only the *Information* and *Discussion* stages are
built now. Research / Modelling / Real-World Projects are future stages —
the data model and routing should not actively block adding them later, but
do not build speculative code for them now (no empty placeholder modules,
no "future-proof" abstractions without a concrete spec).

Core capabilities of the MVP:
- Public, unauthenticated read access to the Information page.
- Auth with roles: `visitor`, `member`, `expert`, `administrator` (more roles
  may be added later — role is a string/enum column, not a hardcoded set of
  booleans).
- Personal account area (view/edit own profile).
- Admin panel to manage Information page content.
- Members/experts can submit **proposals** to change the Information
  content; admins review/accept/reject them.
- Information page has **version history** with access to archived versions.
- i18n: Ukrainian and English, extensible to more locales later.

## 2. Tech stack (pinned — do not substitute without updating this file)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, `strict: true` |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Neon for local/dev/demo) |
| ORM | Prisma |
| Auth | Auth.js (NextAuth v5) + Prisma adapter |
| i18n | next-intl |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Lint/format | ESLint (typescript-eslint) + Prettier |
| Git hooks | Husky + lint-staged |
| CI | GitHub Actions |
| Hosting (demo) | Vercel |

Do not add a new framework-level dependency (new ORM, new auth lib, new CSS
approach, a second UI framework, etc.) without first proposing it as a spec.
Small, well-known utility libraries are fine to add inside a spec's scope.

## 3. Spec-driven workflow (how every change happens)

All work is tracked as **specs** under [`/specs`](specs/README.md). See that
file for the full lifecycle and template. Summary:

1. A spec lives in `specs/backlog/` until someone (human or agent) picks it up.
2. Move it to `specs/active/` when you start implementing it.
3. Implement strictly within the spec's declared scope. If you discover the
   spec is wrong or incomplete, stop and edit the spec first (or flag it),
   don't silently improvise.
4. Write/update tests as part of the same change — not as a follow-up.
5. Run all quality gates locally (section 4) before opening a PR.
6. Open a PR whose description references the spec file and lists which
   acceptance criteria are met.
7. Once merged, move the spec file to `specs/done/`. Specs in `done/` are
   immutable history — never edit them; if behavior changes later, write a
   new spec.

Branch naming: `feature/<spec-id>-<short-slug>`, e.g. `feature/0003-auth-rbac`.

## 4. Quality gates — must all pass before a PR is considered mergeable

```bash
npm run lint        # ESLint, zero warnings
npm run typecheck    # tsc --noEmit, zero errors
npm run test         # Vitest unit/integration tests
npm run build         # production build must succeed
```

Playwright e2e tests (`npm run test:e2e`) run in CI for PRs that touch
user-facing flows; run them locally when your spec says "test plan: e2e".

These same commands run in GitHub Actions on every PR. A PR cannot be merged
if CI is red. Do not weaken a gate (e.g. disable an ESLint rule, add
`// @ts-ignore`, skip a failing test) to make it pass — fix the root cause,
or if the rule is genuinely wrong, propose the change explicitly in the PR
description.

## 5. Coding conventions

- **TypeScript strict everywhere.** No `any` without a one-line comment
  justifying it. Prefer types inferred from Prisma / Zod schemas over
  hand-written duplicate types.
- **Server Components by default**; use `"use client"` only where
  interactivity requires it.
- **Server Actions** for mutations; avoid hand-rolled API routes unless the
  consumer is not the Next.js app itself.
- **All DB access through Prisma.** No raw SQL unless a spec explicitly
  justifies it (and then it must be reviewed as a security-sensitive change).
- **Schema changes go through Prisma Migrate** (`prisma migrate dev`),
  committed as migration files. Never edit an already-applied migration;
  write a new one.
- **RBAC checks are centralized** (a single `requireRole()`/`can()` helper),
  never duplicated ad hoc per route. Every server action/route that mutates
  data must call it.
- **No hardcoded user-facing strings.** Every piece of UI text goes through
  `next-intl` translation keys, added to both `messages/uk.json` and
  `messages/en.json` in the same PR. A string added to only one locale file
  is a bug.
- **No secrets committed.** Env vars go in `.env.local` (gitignored) and are
  documented (names only, no values) in `.env.example`.
- Keep components/functions small and single-purpose; don't introduce an
  abstraction for something used only once.

## 6. Testing expectations

- Every new Server Action, API route, or non-trivial utility function gets at
  least one Vitest test covering the happy path and the main failure mode
  (e.g. unauthorized role, invalid input).
- Every new user-facing flow described in a spec's acceptance criteria gets
  at least one Playwright test exercising it end-to-end.
- Tests are part of the same PR as the feature, not a separate follow-up spec.

## 7. What agents must never do

- Never edit files under `specs/done/`.
- Never bypass or disable CI checks to get a PR merged.
- Never commit secrets, API keys, or `.env` files with real values.
- Never force-push to `main` or rewrite shared history.
- Never implement something outside the current spec's stated scope "while
  I'm at it" — file a new spec instead.
- Never add a dependency that duplicates something already in section 2's
  stack (e.g. a second date library, a second form library) without
  justifying it in the spec.

## 8. Repository layout (target)

```
/app                  Next.js App Router routes
/components           Shared UI components
/lib                  Server-side helpers (auth, rbac, prisma client, etc.)
/prisma               schema.prisma + migrations
/messages             uk.json, en.json (next-intl)
/tests                Vitest unit/integration tests (mirrors /app, /lib)
/e2e                  Playwright tests
/specs                Spec backlog/active/done (see specs/README.md)
.github/workflows     CI pipelines
```
