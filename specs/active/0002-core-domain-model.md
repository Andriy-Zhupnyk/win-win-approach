# 0002 — Core domain model (Prisma schema)

**Status:** Active
**Depends on:** 0001

## Context / why

Auth, the Information page, Discussion, and Proposals all need a shared data
model. Defining it once, deliberately, avoids painful migrations later.

## Scope

- Add Prisma + PostgreSQL connection (Neon), `prisma/schema.prisma`.
- Core models:
  - `User` — id, email, passwordHash (or auth-provider fields — coordinate
    with 0003), displayName, role (`Role` enum: `VISITOR` is implicit/
    unauthenticated and not stored; stored roles are `MEMBER`, `EXPERT`,
    `ADMIN`), createdAt, updatedAt. Role is a single enum column so adding a
    role later is a migration, not a schema redesign.
  - `InformationPage` — a singleton-ish concept representing the current
    published content (could be modeled as "latest `InformationVersion`
    where `status = PUBLISHED`" instead of a separate table — decide during
    implementation, document the choice in the PR).
  - `InformationVersion` — id, versionLabel (e.g. "GS 0.2"), title, body
    (rich text or markdown), publishedAt, authorId (User), status
    (`DRAFT` | `PUBLISHED` | `ARCHIVED`). This is what "version history" is
    built on.
  - `Thread` — id, title, createdById (User), createdAt. Optionally linked
    to an `InformationVersion` it discusses.
  - `Post` — id, threadId, authorId (User), body, createdAt.
  - `Proposal` — id, submittedById (User), targetVersionId (InformationVersion,
    nullable if proposing net-new content), proposedBody, status
    (`PENDING` | `ACCEPTED` | `REJECTED`), reviewedById (User, nullable),
    reviewNote (nullable), createdAt, reviewedAt.
- Initial migration (`prisma migrate dev`) committed to the repo.
- A seed script (`prisma/seed.ts`) creating: one admin user, one member, one
  expert, and one published `InformationVersion` ("GS 0.1") — enough to
  exercise every later spec without hand-creating data each time.

## Non-goals

- No Research/Modelling/Real-World-Project models yet — don't speculatively
  design tables for stages that have no spec.
- No full-text search, no soft-delete framework, no audit log table — add
  only if a later spec needs it.

## Data model changes

As described above — this spec _is_ the data model change.

## User-facing behavior

None directly (no UI yet) — this unblocks 0003/0005/0008/0009.

## i18n

None.

## Acceptance criteria

- [ ] `prisma/schema.prisma` defines all models above with appropriate
      relations and indexes (e.g. index on `Post.threadId`,
      `Proposal.status`).
- [ ] `prisma migrate dev` produces a committed migration that applies
      cleanly on a fresh database.
- [ ] `prisma/seed.ts` runs via `npm run db:seed` and produces the fixtures
      described above.
- [ ] A short note in the PR description explains the `InformationPage` vs
      `InformationVersion` modeling decision.
- [ ] A Vitest integration test exercises at least one create + read round
      trip for each core model against a test database.

## Test plan

Vitest integration tests against a test Postgres database (or Prisma's
in-memory/sqlite test strategy if simpler — document the choice), covering
create + relation fetch for `User`, `InformationVersion`, `Thread`/`Post`,
`Proposal`.
