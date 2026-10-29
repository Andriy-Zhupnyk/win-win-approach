# 0005 — Public Information page + version history

**Status:** Backlog
**Depends on:** 0002, 0004

## Context / why

The brief requires the site to be readable without registration, and the
Information section must expose a version history with access to archived
versions (e.g. "GS 0.1 — August 2026", "GS 0.2 — September 2026").

## Scope

- Public route (no auth required) rendering the current `PUBLISHED`
  `InformationVersion` content.
- A version history view listing all versions (label, publish date, short
  description/title), each linking to a read-only view of that archived
  version's full content.
- Works in both locales (uk/en) — content itself may be stored per-locale
  or as a single version with translated fields; pick one approach and
  document it (simplest for MVP: one `InformationVersion` row has both
  `titleUk`/`titleEn`/`bodyUk`/`bodyEn`, or two linked rows — decide and
  note the tradeoff in the PR).

## Non-goals

- No rich WYSIWYG editing here — that's 0007 (admin panel). This spec is
  read-only display.
- No diffing between versions (e.g. "show what changed from GS 0.1 to
  GS 0.2") — nice future spec, not required now.

## Data model changes

None beyond 0002, unless the per-locale content decision above requires a
small addition (document it).

## User-facing behavior

- Anonymous visitor opens `/uk` or `/en` and sees the current Information
  content without logging in.
- Visitor can navigate to a version history page and open any archived
  version.

## i18n

Keys for version history page labels ("Version history", "Published",
"Archived", etc.) in both locale files.

## Acceptance criteria

- [ ] An unauthenticated request to the Information page succeeds (no
      redirect to login).
- [ ] Version history page lists all seeded versions with correct labels/
      dates, newest first.
- [ ] Clicking an archived version shows its content, clearly marked as
      archived (not confusable with current content).
- [ ] Page renders correctly in both `uk` and `en`.

## Test plan

Playwright: anonymous visit to home → see current content; navigate to
version history → open an archived version → assert archived content and
"archived" indicator are shown. Vitest for the data-fetching logic
(fetch current published version / fetch by id).
