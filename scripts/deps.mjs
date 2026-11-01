#!/usr/bin/env node
// npm run deps:add -- <pkg...>     add dependencies (flags like -D pass through)
// npm run deps:remove -- <pkg...>  remove dependencies
// npm run deps:verify              Linux `npm ci` against the current lockfile
//
// The lockfile is always (re)generated inside a node:24 container, so it is
// complete for Linux CI; afterwards the host's node_modules is restored with
// `npm ci`. Works from Git Bash, PowerShell and Linux shells.
import { spawnSync } from "node:child_process";
import { containerArgs } from "./lib/deps-container.mjs";

const [mode, ...args] = process.argv.slice(2);

if (!["add", "remove", "verify"].includes(mode)) {
  console.error("usage: deps.mjs <add|remove|verify> [packages...]");
  process.exit(2);
}
if (mode !== "verify" && args.length === 0) {
  console.error(`deps:${mode} needs at least one package name`);
  process.exit(2);
}

function findRuntime() {
  for (const bin of ["docker", "podman"]) {
    const probe = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) return bin;
  }
  console.error("Neither docker nor podman was found on PATH.");
  process.exit(1);
}

const runtime = findRuntime();
console.log(`[deps] ${mode}: running in node:24 via ${runtime}...`);
const container = spawnSync(
  runtime,
  containerArgs({ repoDir: process.cwd(), mode, args }),
  {
    stdio: "inherit",
    env: { ...process.env, MSYS_NO_PATHCONV: "1", MSYS2_ARG_CONV_EXCL: "*" },
  },
);
if (container.status !== 0) {
  console.error(`[deps] container step failed (exit ${container.status})`);
  process.exit(container.status ?? 1);
}

if (mode === "verify") process.exit(0);

console.log("[deps] restoring host node_modules with npm ci...");
const host = spawnSync("npm ci", { stdio: "inherit", shell: true });
process.exit(host.status ?? 1);
