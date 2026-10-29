# 0006 — Personal account area

**Status:** Backlog
**Depends on:** 0003, 0004

## Context / why

The brief requires registered users to have a personal account area to view
and edit their personal information.

## Scope

- `/account` route (protected by the middleware/RBAC from 0003, any
  authenticated role).
- View own profile: email, display name, role (read-only — role is not
  self-editable), member-since date.
- Edit: display name (and any other clearly "personal info" field added in
  0002/0003, e.g. avatar/bio — keep minimal for MVP).
- Basic validation (e.g. display name non-empty, reasonable length) with
  user-facing, translated error messages.

## Non-goals

- No email change flow (that usually needs re-verification — separate spec
  if ever needed).
- No password change flow unless trivial to add alongside; if deferred,
  note it as a follow-up spec rather than silently skipping.
- No avatar upload/file storage — a plain text field or no avatar at all is
  fine for MVP.

## Data model changes

None beyond 0002/0003, unless a new editable field is added — if so, it's a
small additive migration, documented in the PR.

## User-facing behavior

- Logged-in user opens `/account`, sees their current info, edits display
  name, saves, sees confirmation and updated value without a full page
  reload feeling broken.

## i18n

Keys for account page labels, field names, validation/error messages, save
confirmation — both locales.

## Acceptance criteria

- [ ] Unauthenticated visitor hitting `/account` is redirected to login.
- [ ] Authenticated user sees their own data only (never another user's).
- [ ] Editing display name persists and is reflected immediately on reload.
- [ ] Invalid input (e.g. empty name) shows a translated validation error
      and does not persist.

## Test plan

Vitest unit test for the update-profile server action (valid + invalid
input, and that it can't touch another user's row). Playwright: login →
edit display name → reload → see updated value.
