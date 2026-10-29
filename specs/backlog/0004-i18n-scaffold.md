# 0004 — i18n scaffold (uk/en)

**Status:** Backlog
**Depends on:** 0001

## Context / why

Retrofitting i18n onto an app that already has hardcoded strings is
expensive. Setting up `next-intl` routing/structure now, before feature
pages exist, means every subsequent spec writes translated strings from the
start.

## Scope

- `next-intl` configured with App Router locale routing (e.g. `/uk/...`,
  `/en/...`), default locale Ukrainian (`uk`), fallback English (`en`) — or
  the reverse if the team prefers; pick one and document it.
- `messages/uk.json`, `messages/en.json` with a small shared namespace
  (`common`) covering things every page needs (nav labels, footer, generic
  error strings).
- A locale switcher component in the layout (visible on every page).
- Lint/CI check (can be a simple script) that fails if a key exists in one
  locale file but not the other — translations must stay in sync by
  construction, not by discipline.
- Document in `CLAUDE.md` or this spec how a new locale would be added
  later (for "additional languages" mentioned in the brief).

## Non-goals

- No actual translation review/quality pass — placeholder/machine-rough
  translations are fine for the demo; this spec is about the *mechanism*,
  not translation quality.
- No per-user locale preference persistence beyond what next-intl's routing
  gives for free.

## Data model changes

None.

## User-facing behavior

- Visiting `/uk` or `/en` (or the root with locale negotiation) renders the
  same page in the respective language.
- A visible control lets the user switch language, and it's preserved
  across navigation.

## i18n

This spec creates the mechanism itself; keys: `common.nav.*`,
`common.footer.*`, `common.errors.generic`.

## Acceptance criteria

- [ ] Both locales render the placeholder home page from 0001 fully
      translated (no raw keys or English leaking into the `uk` locale or
      vice versa).
- [ ] Locale switcher works and persists across navigation.
- [ ] A missing-key check (script or test) fails CI if `uk.json` and
      `en.json` keys diverge.
- [ ] Adding a third locale is documented as "add `messages/xx.json` + one
      line in locale config" — no scattered changes required.

## Test plan

Vitest test for the missing-key check. Playwright test visiting both
locales and asserting on a translated string plus switcher behavior.
