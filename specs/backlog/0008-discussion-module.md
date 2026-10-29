# 0008 — Discussion module

**Status:** Backlog
**Depends on:** 0002, 0003, 0004

## Context / why

"Information → Discussion" is the first step of the platform's core
pipeline. Registered users need a place to discuss socioeconomic issues,
optionally anchored to a specific Information version.

## Scope

- Public read access to threads and posts (consistent with "readable
  without registration").
- Any authenticated role (`MEMBER`, `EXPERT`, `ADMIN`) can create a new
  thread and post replies. Visitors can read but see a prompt to log in to
  participate.
- Thread list view (title, author, created date, reply count, last
  activity) and a thread detail view (original post + replies,
  chronological).
- Optional: a thread can reference an `InformationVersion` it's discussing
  (surfaced as a link back to that version from the thread).
- Basic abuse-prevention is out of scope for MVP (see non-goals) but posts
  must be attributed to their real author (no anonymous posting).

## Non-goals

- No nested/threaded replies (flat chronological list is enough for MVP).
- No editing/deleting posts, no moderation tools, no rate limiting/spam
  prevention — all plausible follow-up specs, not required now.
- No notifications ("someone replied to your thread") — future spec.

## Data model changes

None beyond 0002 (reuses `Thread`/`Post`).

## User-facing behavior

- Anonymous visitor can browse threads and read posts.
- Logged-in member/expert/admin can start a thread and reply to existing
  ones.

## i18n

Keys for thread list/detail labels, "log in to participate" prompt, form
labels — both locales.

## Acceptance criteria

- [ ] Unauthenticated visitor can view thread list and thread detail pages.
- [ ] Unauthenticated visitor cannot create a thread or post (sees a
      translated prompt to log in, not a broken form).
- [ ] Authenticated user can create a thread and reply; posts are
      attributed to the correct author.
- [ ] Thread list correctly reflects reply count and recency ordering.

## Test plan

Vitest unit tests for create-thread/create-post server actions (auth
required, correct attribution). Playwright: anonymous browse → login →
create thread → reply → see it reflected in the list.
