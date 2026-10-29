# 0009 — Proposal workflow

**Status:** Backlog
**Depends on:** 0003, 0005, 0007

## Context / why

The brief requires that registered users with `member` or `expert` roles be
able to submit proposals for changes to the concept (the Information
content), distinct from an admin directly authoring content (0007).

## Scope

- `MEMBER`/`EXPERT` users can submit a `Proposal`: proposed body text,
  optionally targeting a specific existing `InformationVersion` (as "I
  propose changing this") or standing alone as a new-content suggestion.
- A proposal list view for the submitter: see their own proposals and
  status (`PENDING`/`ACCEPTED`/`REJECTED`).
- An admin review view (likely inside `/admin` from 0007): list pending
  proposals, view full proposed content, accept (optionally: accepting
  creates a new `InformationVersion` draft pre-filled from the proposal,
  for the admin to then publish via 0007's flow) or reject with an optional
  review note.
- Submitter can see the admin's review note on rejected/accepted proposals.

## Non-goals

- No threaded discussion *on* a proposal (that's what the Discussion module
  is for, if needed — don't duplicate it here).
- No multi-step/multi-approver workflow — single admin accept/reject is
  enough for MVP.
- Accepting a proposal does not auto-publish it — publishing is still a
  deliberate admin action via 0007, to avoid accidentally pushing
  unreviewed wording live.

## Data model changes

None beyond 0002 (reuses `Proposal`).

## User-facing behavior

- Member/expert submits a proposal, sees it listed as pending.
- Admin sees pending proposals, accepts or rejects with a note.
- Submitter sees the outcome and note on their own proposal list.

## i18n

Keys for proposal form, status labels, review note UI — both locales.

## Acceptance criteria

- [ ] Visitor (unauthenticated) and plain `MEMBER` without the role cannot
      access admin review UI.
- [ ] `MEMBER`/`EXPERT` can submit a proposal; it starts `PENDING`.
- [ ] Admin can accept or reject, optionally with a note; status and note
      are visible to the original submitter.
- [ ] Accepting a proposal does not change the public Information page by
      itself (still requires the separate publish step from 0007).
- [ ] A user can only see their own submitted proposals in their "my
      proposals" view, never another user's.

## Test plan

Vitest unit tests for submit/accept/reject server actions (role checks,
status transitions, ownership isolation). Playwright: login as member →
submit proposal → login as admin → accept with note → login back as member
→ see accepted status and note.
