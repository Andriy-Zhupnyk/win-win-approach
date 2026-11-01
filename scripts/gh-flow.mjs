#!/usr/bin/env node
// GitHub flow helpers, one process per step (no per-call token/curl dance).
//
//   node scripts/gh-flow.mjs pr-create <branch> <title> <body-file>
//   node scripts/gh-flow.mjs ci-wait <branch>
//   node scripts/gh-flow.mjs merge-close <pr-number> <spec-id>
//
// Auth: `gh` if installed and logged in, else GH_TOKEN / git credential helper.
// The token is never printed or written to disk. These commands never decide
// to merge by themselves: run `merge-close` only after the human approved.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { aggregateChecks } from "./lib/checks.mjs";
import { createTransport, encodeRef, parseRemote } from "./lib/github.mjs";
import { tailLines } from "./lib/verify.mjs";
import {
  doneDestination,
  findSpecFile,
  rewriteStatusLine,
} from "./lib/spec-close.mjs";

const BASE = "main";
const POLL_MS = Number(process.env.GH_FLOW_POLL_MS ?? 20_000);
const APPEAR_TIMEOUT_MS = 3 * 60_000;
const TOTAL_TIMEOUT_MS = 40 * 60_000;

/** @param {string[]} args @param {{ allowFail?: boolean }} [opts] */
function git(args, { allowFail = false } = {}) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status !== 0 && !allowFail) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${res.stderr || res.stdout}`,
    );
  }
  return { ok: res.status === 0, out: (res.stdout ?? "").trim() };
}

function repoSlug() {
  const { owner, repo } = parseRemote(git(["remote", "get-url", "origin"]).out);
  return `/repos/${owner}/${repo}`;
}

/** @param {number} status @param {unknown} data @param {string} what */
function assertOk(status, data, what) {
  if (status < 200 || status >= 300) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String(data.message)
        : String(data).slice(0, 300);
    throw new Error(`${what} failed (HTTP ${status}): ${msg}`);
  }
}

const sleep = (/** @type {number} */ ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function prCreate([branch, title, bodyFile]) {
  if (!branch || !title || !bodyFile) {
    throw new Error("usage: pr-create <branch> <title> <body-file>");
  }
  const api = createTransport();
  const body = readFileSync(bodyFile, "utf8");
  const { status, data } = await api.request("POST", `${repoSlug()}/pulls`, {
    head: branch,
    base: BASE,
    title,
    body,
  });
  assertOk(status, data, "create PR (is the branch pushed to origin?)");
  console.log(`PR #${data.number}: ${data.html_url}`);
}

async function ciWait([branch]) {
  if (!branch) throw new Error("usage: ci-wait <branch>");
  const api = createTransport();
  const repo = repoSlug();
  const started = Date.now();
  let lastLine = "";
  for (;;) {
    const ref = await api.request(
      "GET",
      `${repo}/git/ref/heads/${encodeRef(branch)}`,
    );
    assertOk(ref.status, ref.data, `look up branch ${branch} on origin`);
    const sha = ref.data.object.sha;
    const res = await api.request(
      "GET",
      `${repo}/commits/${sha}/check-runs?per_page=100`,
    );
    assertOk(res.status, res.data, "list check runs");
    const verdict = aggregateChecks(res.data.check_runs);

    const line = `${sha.slice(0, 7)}: ${verdict.state}${verdict.state === "pending" ? ` (${verdict.pending} running)` : ""}`;
    if (line !== lastLine) console.log(line);
    lastLine = line;

    if (verdict.state === "success") return;
    if (verdict.state === "failure") {
      for (const run of verdict.failed) {
        console.log(`\n--- FAILED: ${run.name} (${run.conclusion}) ---`);
        // For GitHub Actions the check-run id is the job id.
        const logs = await api.request(
          "GET",
          `${repo}/actions/jobs/${run.id}/logs`,
        );
        console.log(
          logs.status === 200
            ? tailLines(String(logs.data), 60)
            : `(no log available, see ${run.details_url})`,
        );
      }
      process.exitCode = 1;
      return;
    }
    const elapsed = Date.now() - started;
    if (verdict.state === "none" && elapsed > APPEAR_TIMEOUT_MS) {
      throw new Error("no check runs appeared (is a PR open / CI configured?)");
    }
    if (elapsed > TOTAL_TIMEOUT_MS) throw new Error("timed out waiting for CI");
    await sleep(POLL_MS);
  }
}

async function mergeClose([prArg, specId]) {
  const prNumber = Number(prArg);
  if (!Number.isInteger(prNumber) || !/^\d{4}$/.test(specId ?? "")) {
    throw new Error("usage: merge-close <pr-number> <spec-id, e.g. 0010>");
  }
  if (git(["status", "--porcelain"]).out) {
    throw new Error("working tree is not clean; commit or stash first");
  }
  const api = createTransport();
  const repo = repoSlug();

  const pr = await api.request("GET", `${repo}/pulls/${prNumber}`);
  assertOk(pr.status, pr.data, `read PR #${prNumber}`);
  const branch = pr.data.head.ref;
  if (!pr.data.merged) {
    const merge = await api.request("PUT", `${repo}/pulls/${prNumber}/merge`, {
      merge_method: "squash",
    });
    assertOk(merge.status, merge.data, `squash-merge PR #${prNumber}`);
    console.log(`merged PR #${prNumber} (squash)`);
  } else {
    console.log(`PR #${prNumber} already merged, continuing with close-out`);
  }

  git(["checkout", BASE]);
  git(["pull", "--ff-only", "origin", BASE]);

  const active = git(["ls-files", "specs/active"]).out.split("\n");
  const from = findSpecFile(active, specId);
  const to = doneDestination(from);
  git(["mv", from, to]);
  writeFileSync(to, rewriteStatusLine(readFileSync(to, "utf8"), prNumber));
  git(["add", to]);
  git([
    "commit",
    "-m",
    `Close spec ${specId}: move to specs/done/ after merge`,
  ]);
  git(["push", "origin", BASE]);

  git(["branch", "-D", branch], { allowFail: true });
  const del = git(["push", "origin", "--delete", branch], { allowFail: true });
  console.log(
    `closed spec ${specId} -> ${to}; branch ${branch} deleted locally${del.ok ? " and on origin" : " (origin: already gone)"}`,
  );
}

const commands = {
  "pr-create": prCreate,
  "ci-wait": ciWait,
  "merge-close": mergeClose,
};
const [command, ...rest] = process.argv.slice(2);

if (!(command in commands)) {
  console.error(`usage: gh-flow.mjs <${Object.keys(commands).join("|")}> ...`);
  process.exit(2);
}
try {
  await commands[command](rest);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
