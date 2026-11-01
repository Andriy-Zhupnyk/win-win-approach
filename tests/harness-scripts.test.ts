import { describe, expect, it } from "vitest";
import { hasNonDocChanges, isDocPath } from "../scripts/lib/changes.mjs";
import { aggregateChecks } from "../scripts/lib/checks.mjs";
import { containerArgs, SCRIPTS } from "../scripts/lib/deps-container.mjs";
import { parseRemote, redact } from "../scripts/lib/github.mjs";
import {
  doneDestination,
  findSpecFile,
  rewriteStatusLine,
} from "../scripts/lib/spec-close.mjs";
import { formatSummary, runVerify, tailLines } from "../scripts/lib/verify.mjs";

describe("hook change filter", () => {
  it("treats specs and markdown as docs", () => {
    expect(isDocPath("specs/active/0010-x.md")).toBe(true);
    expect(isDocPath("specs/anything.txt")).toBe(true);
    expect(isDocPath("CLAUDE.md")).toBe(true);
    expect(isDocPath("docs\\guide.MD")).toBe(true);
    expect(isDocPath("lib/rbac.ts")).toBe(false);
    expect(isDocPath("package.json")).toBe(false);
  });

  it("skips when only docs changed, runs when anything else did", () => {
    expect(hasNonDocChanges([])).toBe(false);
    expect(hasNonDocChanges(["README.md", "specs/done/0004-a.md"])).toBe(false);
    expect(hasNonDocChanges(["README.md", "app/page.tsx"])).toBe(true);
  });
});

describe("verify runner", () => {
  const fake = (failing?: string) => (name: string) => ({
    ok: name !== failing,
    output: name === failing ? "l1\nl2\nboom" : "",
  });

  it("runs all gates in order when everything passes", () => {
    const seen: string[] = [];
    const verdict = runVerify({
      cwd: ".",
      run: (name) => (seen.push(name), { ok: true, output: "" }),
    });
    expect(verdict.ok).toBe(true);
    expect(seen).toEqual(["lint", "typecheck", "test", "build"]);
  });

  it("stops at the first failure and keeps only the output tail", () => {
    const verdict = runVerify({ cwd: ".", run: fake("typecheck"), tail: 2 });
    expect(verdict.ok).toBe(false);
    expect(verdict.results.map((r) => r.status)).toEqual([
      "pass",
      "fail",
      "skipped",
      "skipped",
    ]);
    const summary = formatSummary(verdict);
    expect(summary).toContain("FAIL typecheck");
    expect(summary).toContain("l2\nboom");
    expect(summary).not.toContain("l1");
  });

  it("tails the last N lines", () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    expect(tailLines(text, 40).split("\n")).toHaveLength(40);
    expect(tailLines(text, 40).endsWith("line 99")).toBe(true);
  });
});

describe("ci-wait aggregation", () => {
  const run = (status: string, conclusion: string | null, id = 1) => ({
    id,
    name: `job${id}`,
    status,
    conclusion,
  });

  it("reports none, pending, success and failure", () => {
    expect(aggregateChecks([]).state).toBe("none");
    expect(
      aggregateChecks([
        run("completed", "success"),
        run("in_progress", null, 2),
      ]),
    ).toMatchObject({ state: "pending", pending: 1 });
    expect(
      aggregateChecks([
        run("completed", "success"),
        run("completed", "skipped", 2),
      ]).state,
    ).toBe("success");
    const failed = aggregateChecks([
      run("completed", "success"),
      run("completed", "failure", 2),
    ]);
    expect(failed.state).toBe("failure");
    expect(failed.failed.map((r) => r.id)).toEqual([2]);
  });
});

describe("merge-close spec move", () => {
  it("rewrites the status line and preserves line endings", () => {
    const lf = "# 0010 — x\n\n**Status:** Active\n**Depends on:** 0001\n";
    expect(rewriteStatusLine(lf, 12)).toBe(
      "# 0010 — x\n\n**Status:** Done (merged in #12)\n**Depends on:** 0001\n",
    );
    const crlf = lf.replaceAll("\n", "\r\n");
    expect(rewriteStatusLine(crlf, 12)).toContain(
      "(merged in #12)\r\n**Depends on:**",
    );
    expect(() => rewriteStatusLine("no status here", 1)).toThrow();
  });

  it("finds the one active spec and its done destination", () => {
    const files = [
      "specs/active/0010-harness.md",
      "specs/active/0011-other.md",
    ];
    expect(findSpecFile(files, "0010")).toBe("specs/active/0010-harness.md");
    expect(() => findSpecFile(files, "0099")).toThrow();
    expect(doneDestination("specs/active/0010-harness.md")).toBe(
      "specs/done/0010-harness.md",
    );
  });
});

describe("deps container + secrets", () => {
  it("mounts the repo with forward slashes and passes packages as arguments", () => {
    const args = containerArgs({
      repoDir: "C:\\WORKS\\app",
      mode: "add",
      args: ["-D", "left-pad; rm -rf /"],
    });
    expect(args).toContain("C:/WORKS/app:/repo");
    expect(args.slice(-3)).toEqual(["sh", "-D", "left-pad; rm -rf /"]);
    // package names reach npm only via "$@", never interpolated into the script
    expect(SCRIPTS.add).toContain('"$@"');
    expect(SCRIPTS.add).not.toContain("left-pad");
  });

  it("verify and add never touch the host node_modules", () => {
    for (const script of Object.values(SCRIPTS)) {
      expect(script).not.toMatch(/\/repo\/node_modules/);
      expect(script).toContain("--ignore-scripts");
    }
  });

  it("redacts the token and parses remotes", () => {
    expect(
      redact(
        "auth failed for ghp_secret123 twice ghp_secret123",
        "ghp_secret123",
      ),
    ).toBe("auth failed for *** twice ***");
    expect(redact("nothing", undefined)).toBe("nothing");
    expect(parseRemote("https://github.com/o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    });
    expect(parseRemote("git@github.com:o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    });
  });

  it("gh-flow never logs the token", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["scripts/gh-flow.mjs", "scripts/lib/github.mjs"]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/console\.\w+\([^)]*token/i);
    }
  });
});
