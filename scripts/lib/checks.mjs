const OK_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);

/**
 * @typedef {{ id: number, name: string, status: string, conclusion: string | null, details_url?: string }} CheckRun
 */

/**
 * Collapse a commit's check runs into one state.
 *  - "none":    no check runs reported yet
 *  - "pending": at least one run has not completed
 *  - "failure": all completed, at least one did not succeed
 *  - "success": all completed successfully (neutral/skipped count as success)
 * @param {CheckRun[]} runs
 * @returns {{ state: "none" | "pending" | "failure" | "success", failed: CheckRun[], pending: number }}
 */
export function aggregateChecks(runs) {
  if (runs.length === 0) return { state: "none", failed: [], pending: 0 };
  const pending = runs.filter((r) => r.status !== "completed").length;
  const failed = runs.filter(
    (r) =>
      r.status === "completed" &&
      !OK_CONCLUSIONS.has(r.conclusion ?? "failure"),
  );
  if (pending > 0) return { state: "pending", failed, pending };
  return { state: failed.length > 0 ? "failure" : "success", failed, pending };
}
