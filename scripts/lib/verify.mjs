import { spawnSync } from "node:child_process";

/** The quality gates from CLAUDE.md §4, in order. */
export const STEPS = ["lint", "typecheck", "test", "build"];

/**
 * @param {string} text
 * @param {number} n
 */
export function tailLines(text, n = 40) {
  const lines = text.replace(/\s+$/, "").split(/\r?\n/);
  return lines.slice(-n).join("\n");
}

/**
 * Runs one `npm run <step>` and captures its output (no live streaming, so a
 * passing run costs a single summary line instead of kilobytes of logs).
 * @param {string} step
 * @param {string} cwd
 */
export function runStep(step, cwd) {
  const res = spawnSync(`npm run ${step}`, {
    cwd,
    shell: true,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  return {
    ok: res.status === 0,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}${res.error ? String(res.error) : ""}`,
  };
}

/**
 * @typedef {{ name: string, status: "pass" | "fail" | "skipped", ms: number, tail: string }} StepResult
 */

/**
 * Runs the gates in order and stops at the first failure.
 * @param {{ cwd: string, steps?: string[], run?: typeof runStep, tail?: number, now?: () => number }} opts
 * @returns {{ ok: boolean, results: StepResult[] }}
 */
export function runVerify({
  cwd,
  steps = STEPS,
  run = runStep,
  tail = 40,
  now = Date.now,
}) {
  /** @type {StepResult[]} */
  const results = [];
  let failed = false;
  for (const name of steps) {
    if (failed) {
      results.push({ name, status: "skipped", ms: 0, tail: "" });
      continue;
    }
    const started = now();
    const { ok, output } = run(name, cwd);
    results.push({
      name,
      status: ok ? "pass" : "fail",
      ms: now() - started,
      tail: ok ? "" : tailLines(output, tail),
    });
    if (!ok) failed = true;
  }
  return { ok: !failed, results };
}

/**
 * One line per step, then the output tail of the failing step (if any).
 * @param {{ ok: boolean, results: StepResult[] }} verdict
 */
export function formatSummary({ ok, results }) {
  const marks = { pass: "PASS", fail: "FAIL", skipped: "SKIP" };
  const lines = results.map(
    (r) =>
      `${marks[r.status]} ${r.name}${r.status === "skipped" ? "" : ` (${(r.ms / 1000).toFixed(1)}s)`}`,
  );
  lines.push(ok ? "verify: all gates passed" : "verify: FAILED");
  const failure = results.find((r) => r.status === "fail");
  if (failure) {
    lines.push("", `--- last lines of "${failure.name}" ---`, failure.tail);
  }
  return lines.join("\n");
}
