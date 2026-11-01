import { spawnSync } from "node:child_process";

/**
 * Is this repo-relative path documentation-only (specs or markdown)?
 * @param {string} file
 */
export function isDocPath(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized.startsWith("specs/") || /\.md$/i.test(normalized);
}

/**
 * True when at least one changed path is outside `specs/` and `*.md`.
 * @param {string[]} files repo-relative paths
 */
export function hasNonDocChanges(files) {
  return files.some((file) => file.length > 0 && !isDocPath(file));
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
function git(args, cwd) {
  const res = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: res.status === 0, out: res.stdout ?? "" };
}

/** @param {string} out NUL-separated git output */
function splitNul(out) {
  return out.split("\0").filter(Boolean);
}

/**
 * Paths changed on this branch relative to `main`: commits already made on the
 * branch (the implementer commits locally before it stops), staged/unstaged
 * edits, and untracked files. On `main` itself this reduces to the plain
 * working-tree status.
 * @param {string} cwd
 * @returns {string[]}
 */
export function changedFiles(cwd) {
  let base = "HEAD";
  for (const ref of ["main", "origin/main"]) {
    const mb = git(["merge-base", "HEAD", ref], cwd);
    if (mb.ok && mb.out.trim()) {
      base = mb.out.trim();
      break;
    }
  }
  const tracked = git(["diff", "--name-only", "--no-renames", "-z", base], cwd);
  const untracked = git(
    ["ls-files", "--others", "--exclude-standard", "-z"],
    cwd,
  );
  return [...new Set([...splitNul(tracked.out), ...splitNul(untracked.out)])];
}

/**
 * @param {string} cwd
 * @returns {string} repo root, or `cwd` when not inside a git repo
 */
export function repoRoot(cwd) {
  const top = git(["rev-parse", "--show-toplevel"], cwd);
  return top.ok && top.out.trim() ? top.out.trim() : cwd;
}
