/** Shell snippets run inside the node:24 container (POSIX sh). */

// Work on a copy of package.json in /work so the host's node_modules is never
// touched and no lifecycle scripts (prisma generate) run. With no lockfile in
// /work, npm does a full fresh resolution, which includes the cross-platform
// optional entries that a Windows `npm install` prunes (CLAUDE.md §4.1).
const PREPARE = [
  "set -e",
  "mkdir /work && cd /work",
  "cp /repo/package.json .",
  "if [ -f /repo/.npmrc ]; then cp /repo/.npmrc .; fi",
];

export const SCRIPTS = {
  add: [
    ...PREPARE,
    'npm install --package-lock-only --ignore-scripts "$@"',
    "cp package.json package-lock.json /repo/",
  ].join("\n"),
  remove: [
    ...PREPARE,
    'npm uninstall --package-lock-only --ignore-scripts "$@"',
    "cp package.json package-lock.json /repo/",
  ].join("\n"),
  verify: [
    ...PREPARE,
    "cp /repo/package-lock.json .",
    "npm ci --ignore-scripts",
    'echo "Linux npm ci OK"',
  ].join("\n"),
};

/**
 * Host path in the form docker/podman accept on Windows (`C:/dir`, no
 * backslashes). Passed as an argument by node, so Git Bash's MSYS path
 * conversion never applies; we also set MSYS_NO_PATHCONV for safety.
 * @param {string} dir
 */
export function toMountPath(dir) {
  return dir.replaceAll("\\", "/");
}

/**
 * @param {{ repoDir: string, mode: keyof typeof SCRIPTS, args?: string[] }} opts
 * @returns {string[]} arguments for `docker` / `podman`
 */
export function containerArgs({ repoDir, mode, args = [] }) {
  return [
    "run",
    "--rm",
    "-v",
    `${toMountPath(repoDir)}:/repo`,
    "-w",
    "/repo",
    "node:24",
    "sh",
    "-c",
    SCRIPTS[mode],
    "sh",
    ...args,
  ];
}
