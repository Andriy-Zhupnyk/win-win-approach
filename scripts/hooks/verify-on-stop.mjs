#!/usr/bin/env node
// SubagentStop hook (see .claude/settings.json): runs `verify` once when the
// implementer finishes, but only if non-doc files changed. Never runs e2e.
//
// Hook protocol (https://code.claude.com/docs/en/hooks):
//  - exit 2 + stderr  -> blocks the subagent from stopping, stderr is fed back
//  - exit 0           -> lets it stop; `systemMessage` is shown to the user
//  - `stop_hook_active` is true when the agent is already continuing because
//    of an earlier block of this hook; we must not block a second time.
import { changedFiles, hasNonDocChanges, repoRoot } from "../lib/changes.mjs";
import { formatSummary, runVerify } from "../lib/verify.mjs";

async function readPayload() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

const payload = await readPayload();
const root = repoRoot(payload.cwd ?? process.cwd());

if (!hasNonDocChanges(changedFiles(root))) process.exit(0);

const verdict = runVerify({ cwd: root });
if (verdict.ok) process.exit(0);

const report = formatSummary(verdict);
if (payload.stop_hook_active) {
  console.log(
    JSON.stringify({
      systemMessage: `verify still failing after one retry, not blocking again:\n${report}`,
    }),
  );
  process.exit(0);
}
console.error(report);
process.exit(2);
