# 0010 — Harness cost optimization

**Status:** Active
**Depends on:** 0001

## Context / why

Specs 0001–0004 were built in one long orchestrating session. One measured
window, at the end of spec 0004 (push → PR #4 → CI check → merge → close-out),
cost **$7.23**, about 24% of the monthly budget. Almost none of that was
useful work:

- Roughly 22 model requests, each re-reading a **284k-token** context (160k
  conversation history, ~100k tool definitions), on the most expensive
  model (Opus), for purely mechanical steps: git, curl, `git mv`.
- The session was resumed after a multi-day break, so the whole context was
  written to the prompt cache again at full price.
- Every change was verified three times: by the implementer subagent, again
  by the orchestrator (including a ~9 min Linux `npm ci`), then by CI.
- The same noise came back in every spec: phantom CRLF "modified" files,
  3–5 tool calls per GitHub operation (no `gh` CLI, hand-rolled
  token + curl + node), and full-context `ScheduleWakeup` turns while waiting
  for CI.

This spec moves deterministic work out of the LLM loop and keeps the context
small. Do it **before 0005**, since every remaining MVP spec pays the cost
again otherwise.

## Scope

1. **Line endings:** add `.gitattributes` (`* text=auto eol=lf`, with binary
   assets such as `*.ico`/`*.png` marked `binary`) and renormalize the repo
   (`git add --renormalize .`) in the same PR.
2. **Single gates command:** `npm run verify` runs lint → typecheck → test →
   build, stops at the first failure, and prints a short pass/fail summary
   per step.
3. **Implementer subagent definition:** `.claude/agents/spec-implementer.md`
   with `model: sonnet`. It carries the standing instructions (read
   `CLAUDE.md` and the given spec, work on the current branch, move the spec
   to `active/`, commit locally, never push/merge/open PRs, short structured
   report) so that orchestrator prompts shrink to
   "Implement `specs/backlog/NNNN-...md`".
4. **Gates hook (deterministic loop, no planner):** project-level hook in
   `.claude/settings.json` on **`SubagentStop`** (optionally also `Stop`)
   that runs `npm run verify` **once, when the task finishes**, not on every
   Edit/Write.
   - Skips entirely if `git status --porcelain` shows no changes outside
     `specs/` and `*.md`.
   - On failure, blocks the stop (exit code 2, per the Claude Code hooks
     docs; confirm the exact semantics against the docs when implementing)
     and feeds back the last ~40 lines of the failing step.
   - Must not loop forever: respect the hook payload's `stop_hook_active`
     flag so a second consecutive failure ends the agent's turn with the
     failure reported, instead of retrying indefinitely.
   - Does **not** run e2e or the Linux lockfile check (too slow). Those stay
     in CI and in item 5 respectively.
   - Implemented as a Node script (e.g. `scripts/hooks/verify-on-stop.mjs`)
     so it behaves the same on Windows and Linux.
5. **Lockfile generated on Linux:** `npm run deps:add -- <pkg...>` (and
   `deps:remove`) regenerates `package-lock.json` from scratch **inside a
   `node:24` container**, then restores the host's `node_modules` with
   `npm ci`. `npm run deps:verify` runs Linux `npm ci` against the current
   lockfile. Both must work from Git Bash on Windows (handle
   `MSYS_NO_PATHCONV`). This removes the Windows pruning bug class (CLAUDE.md
   §4.1) instead of documenting around it.
6. **GitHub flow scripts:** `scripts/gh-flow.mjs` with subcommands:
   - `pr-create <branch> <title> <body-file>`
   - `ci-wait <branch>`: polls until all check runs finish in **one**
     process; exits 0/1; on failure prints the tail of the failing job's log
   - `merge-close <pr-number> <spec-id>`: squash-merge, pull `main`, move
     the spec to `done/`, set its status line, commit, push, delete the
     branch locally and on origin

   Uses `gh` if it is installed, otherwise the GitHub REST API with a token
   from `GH_TOKEN` or `git credential fill`. **The token must never be
   printed or written to disk.** The scripts never decide to merge on their
   own; the orchestrator calls `merge-close` only after the human approves.

7. **CLAUDE.md updates:**
   - New section "Working cost-efficiently":
     - one spec per session (`/clear` or a new session after each merge;
       all state lives in the repo)
     - which model for which role (Opus for writing specs and judgment
       calls, Sonnet for implementation, scripts for mechanical steps)
     - the orchestrator does not re-run gates already proven by the hook
       and CI
     - short subagent prompts
   - Shorten §4.1 to point at the `deps:*` scripts.
8. **Cost measurement:** add `.github/pull_request_template.md` with a
   "Cost" section (spend snapshot at spec start/end, model(s) used), filled
   in by the human.

## Non-goals

- No application/feature code changes.
- No CI workflow changes (e.g. Playwright browser caching): a separate spec
  if CI time becomes a concern.
- Disabling unused MCP servers (~58k tokens of tool definitions per request)
  is a user/environment setting, not a repo change. Record it as a manual
  recommendation in `CLAUDE.md`, don't automate it.
- No third-party agent orchestration framework.

## Data model changes

None.

## User-facing behavior

None. This changes the development harness only.

## i18n

None.

## Acceptance criteria

- [ ] `.gitattributes` exists; after a fresh clone on Windows, `npm ci`,
      `npm run build` and `npm run test:e2e` leave `git status` clean (no
      phantom modified files).
- [ ] `npm run verify` exists, runs the four gates in order, and exits
      non-zero if any of them fails.
- [ ] `.claude/agents/spec-implementer.md` exists with `model: sonnet` and
      the standing instructions above.
- [ ] The `SubagentStop` hook is committed in `.claude/settings.json`: - runs `verify` only when non-doc files changed - on failure blocks once with a ≤40-line failure tail - does not block a second consecutive time (`stop_hook_active`) - never runs e2e
- [ ] `npm run deps:add`, `deps:remove` and `deps:verify` work from Git Bash
      on Windows. A lockfile produced by `deps:add` passes `npm ci` both in
      the Linux container and on Windows.
- [ ] `scripts/gh-flow.mjs` `pr-create` / `ci-wait` / `merge-close` work
      against this repo. A test or grep check confirms the token value is
      never echoed.
- [ ] `CLAUDE.md` has the "Working cost-efficiently" section and the
      shortened §4.1.
- [ ] `.github/pull_request_template.md` has the Cost section.

## Test plan

- Vitest unit tests for the scripts' pure logic:
  - the hook's "did non-doc files change" filter
  - the spec move / status-line rewrite in `merge-close`
  - the CI-status aggregation in `ci-wait`
- Manual check of the hook on a scratch branch: introduce a deliberate lint
  error, run the implementer subagent, confirm it is blocked once with the
  error tail; confirm a docs-only change skips `verify` entirely.
- Manual run of `deps:add` / `deps:verify` once on Windows (Git Bash).
- **After merge, validation:** implement spec 0005 through the new flow (fresh
  session, `spec-implementer` subagent, `gh-flow.mjs`) and record its cost
  in the PR template. Compare it with the 0004 measurement ($7.23 for the
  close-out window alone).
