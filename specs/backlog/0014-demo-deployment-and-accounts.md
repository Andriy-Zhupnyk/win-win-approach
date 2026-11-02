# 0014 — Demo deployment and demo accounts

**Status:** Backlog
**Depends on:** 0003, 0005, 0012

## Context / why

The MVP (Information, Discussion, accounts, admin panel, proposals) only runs on
a developer machine today. The task requires a live demonstration, and a public
URL where anyone can register with a real email, discuss and propose changes is
far more convincing than a local run. `CLAUDE.md` already names the demo stack
(Vercel for the app, Neon for PostgreSQL); nothing has been set up yet.

Two gaps also block a good demo:

- The seeded users (`admin@…`, `member@…`, `expert@…`) have **no password**, so
  nobody can sign in as them (see `README.md`). Registration only creates
  `MEMBER`, and there is no way to obtain an `ADMIN` or `EXPERT` account without
  editing the database by hand.
- The app has never run against a hosted database.

## Scope

1. **Hosted deployment (Vercel + Neon).** The agent prepares the repo for it;
   a human performs the account/dashboard steps listed under "Human steps".
   - Document the required environment variables (names only) in
     `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, plus any others found
     necessary (e.g. a direct, non-pooled URL for migrations, and whether
     `AUTH_TRUST_HOST` is needed on Vercel — verify, do not assume).
   - Decide and document where `prisma migrate deploy` runs (e.g. a manual
     step or a CI step), not implicitly on every Vercel build.
   - Decide how preview deployments get their data (a separate Neon branch, or
     previews disabled), so a PR preview never writes to the demo database.
   - A short runbook in `README.md`: deploy, migrate, seed, rotate secrets, tear down.
2. **Admin bootstrap script**, e.g. `npm run admin:create`, for the owner:
   - Takes the admin email as an argument (or prompt), and **prompts for the
     password with hidden input** (never as a command-line argument, never from a
     file in the repo), hashes it with bcrypt (same cost as registration), and
     upserts the user with role `ADMIN` directly through Prisma.
   - Refuses to run unless `DATABASE_URL` is explicitly set, prints which
     database host it is about to modify and asks for confirmation.
   - The password is never printed, logged or stored anywhere.
3. **Demo accounts for roles.** A separate, explicitly opt-in seed (e.g.
   `npm run db:seed:demo`) that gives the seeded `member` and `expert` users a
   password taken from an environment variable (`DEMO_ACCOUNTS_PASSWORD`), never
   a value committed to the repo. It must refuse to run if the variable is
   missing and must **never create or change an `ADMIN`**. The normal
   `db:seed` stays unchanged (no passwords).
4. **Registration with real emails on the public demo.**
   - Keep the existing flow (email + password, role `MEMBER`).
   - Add a short, translated privacy notice on the register page (uk and en):
     what is stored (email, display name, password hash), that this is a demo,
     and how to ask for deletion.
   - There is **no email verification** (spec 0003 non-goal), so anyone can
     register any address. Consequence the implementer must respect: nothing
     may grant a role based on an unverified email address. Admin rights come
     only from step 2, never from "the email matches".
5. **Smoke test of the deployed site** (documented manual checklist, plus a
   Playwright run against the URL if practical): register, log in, create a
   thread, reply, view versions, admin publishes a version, log out.

## Human steps (cannot be done by an agent)

- Create the Neon project/database and the Vercel project linked to the GitHub
  repository; set the environment variables in the Vercel dashboard.
- Run `npm run admin:create` locally against the hosted `DATABASE_URL` and type
  the administrator password at the prompt. **The password must never be sent
  in chat, committed, put in an issue/PR, or passed on a command line.**
- Choose and store `DEMO_ACCOUNTS_PASSWORD` and `AUTH_SECRET` in a password
  manager / the Vercel dashboard.

## Non-goals

- No email verification, password reset or email sending (needs an email
  provider; a separate spec if wanted).
- No custom domain, analytics, monitoring or CDN tuning.
- No role-management UI (that is spec 0015).
- No change to application features or to CI workflow behavior.

## Data model changes

None expected.

## User-facing behavior

- A public URL where visitors can read, register with a real email, discuss and
  propose changes; the owner can sign in as administrator; the presenter can sign
  in as demo member/expert.
- A privacy notice on the register page.

## i18n

New keys for the privacy notice and any register-page wording, in both
`messages/uk.json` and `messages/en.json`.

## Acceptance criteria

- [ ] The app runs on a public Vercel URL against a Neon database; registration,
      login, threads, replies, versions and proposals work and persist.
- [ ] `npm run admin:create` creates/updates an administrator with a password typed
      at a hidden prompt; the password appears nowhere (shell history, logs, repo).
- [ ] The demo seed gives `member` and `expert` working logins from
      `DEMO_ACCOUNTS_PASSWORD`, refuses to run without it, and never touches `ADMIN`.
- [ ] No role is ever assigned based on an unverified email address (a test
      registers the owner's email through the normal form and gets `MEMBER`).
- [ ] The register page shows the translated privacy notice in both locales.
- [ ] `.env.example` lists the needed variable names (no values); no secret or
      personal email is committed (the administrator email is supplied at run time).
- [ ] `README.md` has the deploy/migrate/seed/rotate/teardown runbook.
- [ ] `npm run verify` passes; CI is green.

## Test plan

- Vitest: the bootstrap script's pure logic (argument handling, refusal when
  `DATABASE_URL` is missing, never printing the password); the demo seed's refusals
  and its guarantee not to create `ADMIN`; "registering any email yields `MEMBER`".
- Playwright: privacy notice visible in both locales on the register page.
- Manual: the smoke checklist on the deployed URL.
