# 0015 — Role management UI

**Status:** Done (merged in #15)
**Depends on:** 0003, 0007, 0014

## Context / why

Registration always creates a `MEMBER`. Today the only way to make someone an
`EXPERT` or `ADMIN` is to edit the database by hand, which does not work for a
live demo and is easy to get wrong. Administrators need a small, safe screen to
see users and change their role. (The first administrator is created by the
bootstrap script from spec 0014, not by this UI.)

## Scope

1. **Page `/admin/users`** (ADMIN only, enforced like the rest of `/admin`:
   middleware plus `requirePageRole` in the page): a table of users with email,
   display name, role, registration date; paginated or capped, ordered by
   registration date. A link from the admin page.
2. **Server action to change a role**, using the centralized `requireRole` from
   `lib/rbac.ts` and validating the target role against the `Role` enum. The id
   of the acting user comes from the session, never from the form.
3. **Safety rules** (enforced on the server, with tests):
   - An administrator cannot change **their own** role.
   - The **last remaining `ADMIN`** can never be demoted.
   - Only roles that already exist in the `Role` enum can be assigned; no role
     can be created from the UI.
4. **Stale role in the session.** Roles are stored in the JWT at sign-in
   (spec 0003), so after a change the affected user keeps their old role until
   the token is re-issued. The implementer must resolve this deliberately and
   document the choice in the PR; recommended: **privileged actions (`/admin`
   pages and actions, including this one) re-read the role from the database**
   instead of trusting the token, keeping the single `lib/rbac.ts` helper as the
   only place that decides. Report what happens to a demoted administrator's
   already-open session.
5. **Audit trail, minimal:** each role change is recorded in the server log
   (actor id, target id, old and new role; no emails or secrets).
   A database audit table is out of scope.

## Non-goals

- No creating, deleting or deactivating users, no editing emails/passwords.
- No new roles, no per-resource permissions, no invitation or approval flow.
- No email notification to the affected user.
- No change to how the first administrator is created (spec 0014).

## Data model changes

None expected (reuses `User.role`). If the implementer finds one is needed, stop
and edit this spec first.

## User-facing behavior

An administrator opens Admin → Users, picks a new role for a user from a select
and confirms; the table updates and a translated success or error message is
shown. Non-admins and visitors cannot reach the page or the action.

## i18n

Keys for the page title, table headers, role names, confirmation, success and
error messages (own role, last admin, invalid role), in both `uk.json` and
`en.json`.

## Acceptance criteria

- [ ] `/admin/users` is reachable only by an administrator; visitors are
      redirected to login and members/experts to the forbidden page.
- [ ] An administrator can change another user's role between `MEMBER`,
      `EXPERT` and `ADMIN`, and the change persists.
- [ ] An administrator cannot change their own role; the last `ADMIN` cannot be
      demoted; both show a translated error and change nothing.
- [ ] A forged form field cannot change a role without an authenticated
      administrator, nor choose a value outside the `Role` enum.
- [ ] The decision about stale JWT roles is implemented and documented; a
      demoted administrator loses access to `/admin` and its actions
      (stated how quickly, with a test).
- [ ] Each role change is logged without emails or secrets.
- [ ] `npm run verify` passes; CI is green, including e2e.

## Test plan

- Vitest (real database, like `tests/admin-actions.test.ts`): role × action
  matrix, self-change refusal, last-admin refusal, invalid role, forged actor,
  the stale-role behavior from Scope 4.
- Playwright: administrator promotes a member to expert; the expert then sees the
  Proposals link; a member cannot open `/admin/users` (both locales where cheap).
- Mind the single-`PUBLISHED` index and shared data: new users get unique emails.
