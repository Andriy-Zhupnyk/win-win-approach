import { spawnSync } from "node:child_process";

/**
 * "https://github.com/o/r.git" | "git@github.com:o/r.git" -> { owner, repo }
 * @param {string} url
 */
export function parseRemote(url) {
  const m = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error(`cannot parse GitHub owner/repo from remote: ${url}`);
  return { owner: m[1], repo: m[2] };
}

/**
 * Remove every occurrence of a secret from text before it can be printed.
 * @param {string} text
 * @param {string | undefined} secret
 */
export function redact(text, secret) {
  return secret ? text.split(secret).join("***") : text;
}

/** Percent-encode each path segment but keep the slashes of a branch name. */
export const encodeRef = (/** @type {string} */ ref) =>
  ref.split("/").map(encodeURIComponent).join("/");

/**
 * Token from GH_TOKEN / GITHUB_TOKEN, else from git's credential helper. It is
 * only ever held in memory and sent in the Authorization header.
 * @returns {string}
 */
export function resolveToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  const res = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const password = (res.stdout ?? "").match(/^password=(.+)$/m)?.[1]?.trim();
  if (!password) {
    throw new Error(
      "no GitHub token: set GH_TOKEN, install `gh` and run `gh auth login`, or configure a git credential helper for github.com",
    );
  }
  return password;
}

/**
 * @typedef {{ status: number, data: any }} ApiResponse
 * @typedef {{ request: (method: string, path: string, body?: unknown) => Promise<ApiResponse> }} Transport
 */

/** REST transport over fetch with a bearer token. @returns {Transport} */
export function restTransport(/** @type {string} */ token) {
  const base = "https://api.github.com";
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "win-win-gh-flow",
  };
  return {
    async request(method, path, body) {
      try {
        let res = await fetch(`${base}${path}`, {
          method,
          redirect: "manual",
          headers: {
            ...headers,
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        // Log downloads redirect to a pre-signed URL on another host: follow
        // it WITHOUT the Authorization header.
        if (
          res.status >= 300 &&
          res.status < 400 &&
          res.headers.get("location")
        ) {
          res = await fetch(
            /** @type {string} */ (res.headers.get("location")),
          );
        }
        const text = await res.text();
        let data = text;
        try {
          data = JSON.parse(text);
        } catch {
          // plain-text body (job logs)
        }
        return { status: res.status, data };
      } catch (err) {
        throw new Error(redact(String(err), token));
      }
    },
  };
}

/** Transport that delegates auth and HTTP to the `gh` CLI. @returns {Transport} */
export function ghCliTransport() {
  return {
    async request(method, path, body) {
      const args = ["api", "-X", method, path, "-i"];
      if (body) args.push("--input", "-");
      const res = spawnSync("gh", args, {
        input: body ? JSON.stringify(body) : undefined,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      const out = res.stdout ?? "";
      const [head, ...rest] = out.split(/\r?\n\r?\n/);
      const status = Number(head.match(/^HTTP\/[\d.]+ (\d+)/)?.[1] ?? 0);
      const text = rest.join("\n\n");
      let data = text;
      try {
        data = JSON.parse(text);
      } catch {
        // plain-text body (job logs)
      }
      return { status, data };
    },
  };
}

/** Prefer `gh` when installed and authenticated, else REST with a token. */
export function createTransport() {
  const gh = spawnSync("gh", ["auth", "status"], { stdio: "ignore" });
  return gh.status === 0 ? ghCliTransport() : restTransport(resolveToken());
}
