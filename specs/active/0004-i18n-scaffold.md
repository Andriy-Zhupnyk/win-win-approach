# 0004 — i18n scaffold (uk/en)

**Status:** Active
**Depends on:** 0001

## Context / why

Retrofitting i18n onto an app that already has hardcoded strings is
expensive. Setting up `next-intl` routing/structure now, before feature
pages exist, means every subsequent spec writes translated strings from the
start.

### Expanded scope note (added when this spec was picked up)

This spec was written before spec 0003 (Auth.js + RBAC) existed, so the
text below only talks about translating the placeholder home page from 0001. By the time this spec was implemented, spec 0003 had already shipped
real pages (`/login`, `/register`, `/account`, `/admin`, `/forbidden`, the
site nav) with hardcoded English strings — its own implementer flagged
this gap explicitly for whoever picked up 0004 next.

Decision made by the implementing agent (confirmed with the orchestrating
session): **this implementation also retrofits every page/component/
server action that spec 0003 shipped** to go through `next-intl`, not just
the home page. Building the i18n mechanism without migrating any real
screen to use it would leave `CLAUDE.md` section 5's "no hardcoded
user-facing strings" rule violated for the entire app, and would just move
the retrofit cost to whichever later spec touches those pages next. The
rest of this spec's scope, non-goals, and acceptance criteria are
unchanged and still apply; this note only widens _which files_ get
translated, not the mechanism itself.

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
  translations are fine for the demo; this spec is about the _mechanism_,
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

This spec creates the mechanism itself. Implemented key namespaces (see
`messages/en.json` / `messages/uk.json`): `common` (site name/description),
`nav`, `localeSwitcher`, `home`, `auth.login`, `auth.register`
(incl. `auth.register.errors`), `account` (incl. `account.roles`), `admin`,
`forbidden`. The originally-sketched `common.nav.*`/`common.footer.*`/
`common.errors.generic` keys were reshaped into their own top-level
namespaces once real pages existed to translate — there is no footer or
generic-error surface in the app yet, so those two specific keys were not
added speculatively (per this spec's own non-goals and CLAUDE.md's
guidance against building unused abstractions).

### Locale/routing decision

Default locale: **Ukrainian (`uk`)**. Secondary/fallback locale:
**English (`en`)**. `localePrefix: "always"` — every page lives under
`/uk/...` or `/en/...`; visiting an unprefixed path (including `/`) is
redirected by `middleware.ts` (via `next-intl`'s middleware) to the
negotiated locale.

### Adding a new locale later

1. Add `messages/<code>.json` with exactly the same keys as
   `messages/en.json` (the missing-key test in
   `tests/i18n-keys.test.ts` only compares `en`/`uk` today — extend it to
   loop over all locale files once a third locale is added, or keep
   comparing every file pairwise against `en.json` as the reference).
2. Add `<code>` to `routing.locales` in `i18n/routing.ts`.
3. Add `<code>` to the `MESSAGES` map in `app/[locale]/login/actions.ts`
   and `app/[locale]/register/actions.ts` (these two Server Actions use
   `createTranslator` with statically-imported message files rather than
   request-scoped detection — see the comment in
   `app/[locale]/register/actions.ts` for why).

No other scattered changes are required — every page/component reads
through `useTranslations`/`getTranslations`, which resolve the locale from
`i18n/request.ts` automatically for any locale present in `routing.locales`.

## Acceptance criteria

- [x] Both locales render the placeholder home page from 0001 fully
      translated (no raw keys or English leaking into the `uk` locale or
      vice versa).
- [x] Locale switcher works and persists across navigation.
- [x] A missing-key check (script or test) fails CI if `uk.json` and
      `en.json` keys diverge. (`tests/i18n-keys.test.ts`, runs as part of
      `npm run test`, which CI already runs.)
- [x] Adding a third locale is documented as "add `messages/xx.json` + one
      line in locale config" — no scattered changes required. (See "Adding
      a new locale later" above; the one extra step versus the original
      sketch is the two Server Actions' `MESSAGES` map, noted there.)
- [x] (Expanded scope) Every page/component/action spec 0003 shipped with
      hardcoded English — `app/[locale]/page.tsx`, `login`, `register`,
      `account`, `admin`, `forbidden`, `components/site-nav.tsx`,
      `components/login-form.tsx`, `components/register-form.tsx`, and the
      `login`/`register` server actions — is translated in both locales.

## Test plan

Vitest test for the missing-key check (`tests/i18n-keys.test.ts`).
Playwright tests visiting both locales (`e2e/home.spec.ts`,
`e2e/auth.spec.ts`) asserting on translated strings (read directly from
`messages/*.json`, so the tests fail if the UI stops using a declared
translation) plus locale-switcher behavior and the full register → login →
forbidden → logout flow in both `en` and `uk`.
