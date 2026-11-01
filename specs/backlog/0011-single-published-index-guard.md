# 0011 — Guard the single-PUBLISHED index against Prisma migration drift

**Status:** Backlog
**Depends on:** 0007

## Context / why

Spec 0007 enforces "at most one `PUBLISHED` `InformationVersion`" at the data
level with a partial unique index, added by migration
`20261101130000_single_published_information_version`. Prisma's schema
language cannot express a partial index, so the index exists only in the
migration SQL (`schema.prisma` just carries a comment).

The risk: on the next `prisma migrate dev` Prisma compares the migrated
database with `schema.prisma`, sees an index the schema does not describe, and
may generate a migration that **drops** it. The guarantee would then silently
disappear (the transaction in `lib/information-admin.ts` would remain, but not
the database-level protection). 0007 also used raw SQL without a spec that
justified it, which `CLAUDE.md` §5 asks for.

This should be settled before the first schema change after 0007, e.g. when
the Research or Modelling stages start.

## Scope

1. **Reproduce first, on a scratch database** (never on the shared dev data):
   apply all migrations, then run `prisma migrate dev --create-only` (or
   `prisma migrate diff --from-migrations … --to-schema …`) with an otherwise
   unchanged schema, and record in the PR whether Prisma wants to drop the
   index. Also check whether the installed Prisma version supports partial
   indexes natively (if it does, move the index into `schema.prisma` in a new
   migration and skip the rest of this list).
2. **Automated guard.** A test (Vitest against the real DB, or a CI step) that
   fails if, after `prisma migrate deploy`, the index is missing. Confirm by
   hand that the guard goes red when the index is dropped, and note that in
   the PR.
3. **Documented procedure.** A short subsection in `CLAUDE.md` §5 (schema
   changes): if `migrate dev` proposes dropping this index, edit the
   _new, not yet applied_ migration to remove the `DROP INDEX`, never edit an
   applied migration; and the justification for raw SQL in migrations
   (partial index not expressible in Prisma).
4. If step 1 shows Prisma does **not** propose dropping the index, record that
   result in the PR and in the `schema.prisma` comment, keep the guard from
   step 2, and skip step 3.

## Non-goals

- No change to the publish/archive behavior or any UI.
- No new indexes or constraints beyond the existing one.
- No switch of ORM, no Prisma preview features unless step 1 shows they
  support partial indexes and are stable enough to rely on (propose that as a
  separate spec if so).

## Data model changes

None expected. At most a new migration if step 1 finds native support (see
Scope 1).

## User-facing behavior

None.

## i18n

None.

## Acceptance criteria

- [ ] The PR states, with the commands used, whether `migrate dev` proposes
      dropping the index on an unchanged schema.
- [ ] A test or CI step fails when the partial unique index is absent after
      `migrate deploy`, and it was shown to fail when the index is dropped.
- [ ] If Prisma proposes the drop: `CLAUDE.md` §5 documents the procedure
      and the raw-SQL justification; if not, the finding is recorded instead.
- [ ] No already-applied migration is edited.
- [ ] `npm run verify` passes; CI is green.

## Test plan

- Vitest: the index-presence guard (e.g. a query on `pg_indexes`), plus the
  existing direct-second-insert and concurrent-publish tests still pass.
- Manual: on a scratch database, drop the index and confirm the guard fails;
  reproduce the `migrate dev` behavior from Scope 1.
