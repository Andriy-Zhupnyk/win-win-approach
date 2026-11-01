#!/usr/bin/env node
// `npm run verify`: lint -> typecheck -> test -> build, stop at first failure,
// print a short per-step summary. Exit code is non-zero if any gate fails.
import { formatSummary, runVerify } from "./lib/verify.mjs";

const verdict = runVerify({ cwd: process.cwd() });
const text = formatSummary(verdict);
if (verdict.ok) {
  console.log(text);
} else {
  console.error(text);
}
process.exit(verdict.ok ? 0 : 1);
