# 0007 — Admin content management panel

**Status:** Backlog
**Depends on:** 0003, 0005

## Context / why

The brief requires a simple admin panel letting administrators add content
to the main Information page, and implies publishing new versions (tying
into the version history from 0005).

## Scope

- `/admin` route (ADMIN role only, enforced via RBAC from 0003).
- A form to create a new `InformationVersion`: version label (e.g.
  "GS 0.3"), title, body (plain markdown textarea is fine for MVP — no need
  for a rich WYSIWYG editor), per-locale fields per the approach chosen in
  0005.
- Publishing a new version: marks the previous `PUBLISHED` version as
  `ARCHIVED` and the new one as `PUBLISHED` (atomic — never two
  simultaneously `PUBLISHED`).
- Admin can also save a version as `DRAFT` without publishing it yet.
- A simple list view of all versions (draft/published/archived) with a
  "publish" action for drafts.

## Non-goals

- No rich-text editor, no image upload, no scheduled/future-dated
  publishing — all nice-to-haves for a later spec.
- This spec does not cover reviewing member/expert *proposals* — that's
  0009. This is direct admin authoring.

## Data model changes

None beyond 0002 (reuses `InformationVersion.status`).

## User-facing behavior

- Admin opens `/admin`, writes a new version, saves as draft, later
  publishes it; the public Information page (0005) immediately reflects
  the newly published version, and the old one becomes an archived entry
  in the version history.

## i18n

Keys for admin form labels, status labels, confirmation/success messages —
both locales. (The admin UI itself doesn't need to be bilingual content-wise
— the *content being authored* is per-locale per 0005's chosen approach —
but UI chrome strings still go through next-intl.)

## Acceptance criteria

- [ ] Non-admin roles (including unauthenticated) cannot reach `/admin`
      (verified via RBAC, not just hidden UI).
- [ ] Creating a draft does not change what's publicly visible.
- [ ] Publishing a draft archives the previously published version and
      makes the new one the public current content.
- [ ] At most one `PUBLISHED` version exists at any time (enforced at the
      data layer, not just by UI convention).
- [ ] Version history page (0005) shows the newly archived version.

## Test plan

Vitest unit test for the publish action (archives old, publishes new,
rejects if called by non-admin). Playwright: login as admin → create draft
→ publish → verify public page and version history updated; login as
member → confirm `/admin` is inaccessible.
