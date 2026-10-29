# Spec workflow

A **spec** is a short, scoped description of one unit of work for an agent to
implement. Specs are the unit of planning, review, and traceability between
"what the human asked for" and "what the agent built".

## Lifecycle

```
specs/backlog/   →   specs/active/   →   specs/done/
   (not started)       (being built)       (merged, immutable)
```

1. **Backlog** — a spec is written and numbered, but no one is working on it
   yet. Backlog specs can still be edited/refined.
2. **Active** — exactly one agent is implementing it. Move the file from
   `backlog/` to `active/` with `git mv` in the same branch as the
   implementation work (not a separate commit to main).
3. **Done** — merged to `main`. Move the file to `done/` as part of the
   merging PR. Once in `done/`, a spec is historical record and must not be
   edited. If requirements change later, write a new spec that references
   the old one (`Supersedes: 0005-...`).

Only one spec should be `active` per developer/agent at a time, and two
specs that touch the same files should not be active simultaneously.

## Numbering

Specs are numbered globally, 4 digits, zero-padded, incrementing:
`NNNN-kebab-case-title.md` (e.g. `0001-project-scaffold.md`). Never reuse a
number, even if a spec is abandoned — add a `Status: Abandoned` note and
leave it in `backlog/` (or move to `done/` with that status) instead.

## Writing a spec

Use [`TEMPLATE.md`](TEMPLATE.md). Keep it short — a spec should be readable
in under two minutes. It describes **what** and **why** and the boundary of
**what's in/out of scope**; it should not dictate exact code (that's the
agent's job), but it should be precise about acceptance criteria, because
those are what the agent (and CI) use to know when the work is done.

A good spec:
- Is implementable without the agent needing to ask a clarifying question
  about scope (if it can't be, it's not ready to move out of `backlog/`).
- Lists concrete, testable acceptance criteria.
- States explicit non-goals when the natural scope-creep is obvious.
- Names its dependencies on other specs (by number).

## Current backlog (initial foundation + MVP features, in dependency order)

| # | Spec | Depends on |
|---|---|---|
| 0001 | Project scaffold & quality gates | — |
| 0002 | Core domain model (Prisma schema) | 0001 |
| 0003 | Auth & RBAC | 0001, 0002 |
| 0004 | i18n scaffold (uk/en) | 0001 |
| 0005 | Public Information page + version history | 0002, 0004 |
| 0006 | Personal account area | 0003, 0004 |
| 0007 | Admin content management panel | 0003, 0005 |
| 0008 | Discussion module | 0002, 0003, 0004 |
| 0009 | Proposal workflow | 0003, 0005, 0007 |

0001–0004 are foundation work and should be done in roughly that order before
any MVP feature spec starts, since every later spec depends on at least one
of them.
