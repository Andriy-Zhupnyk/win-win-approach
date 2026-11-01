import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Page } from "@playwright/test";
import en from "../messages/en.json";

// Spec 0013: logging out must end the session even when a background request
// that was rendered with the OLD session is still in flight. Next prefetches
// the nav links (RSC requests); if such a response carries a refreshed session
// cookie and lands after logout cleared it, the user is signed in again.
//
// Deterministic by construction, no `networkidle`: prefetches are executed
// against the server straight away (so they run with the old session) but
// their responses are held back until logout has finished, then delivered.

const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token/;
const messages = en;

async function registerAndLogin(page: Page): Promise<void> {
  const runId = randomUUID().slice(0, 8);
  const email = `race-${runId}@test.winwinapproach.invalid`;
  const password = "a-strong-enough-password";

  await page.goto("/en/register");
  await page
    .getByLabel(messages.auth.register.displayNameLabel)
    .fill(`Race ${runId}`);
  await page.getByLabel(messages.auth.register.emailLabel).fill(email);
  await page.getByLabel(messages.auth.register.passwordLabel).fill(password);
  await page
    .getByRole("button", { name: messages.auth.register.submit })
    .click();
  await expect(page.getByText(messages.auth.register.success)).toBeVisible();

  await page.goto("/en/login");
  await page.getByLabel(messages.auth.login.emailLabel).fill(email);
  await page.getByLabel(messages.auth.login.passwordLabel).fill(password);
  await page.getByRole("button", { name: messages.auth.login.submit }).click();
  await expect(page).toHaveURL("/en");
  await expect(page.getByText(`Race ${runId}`)).toBeVisible();
}

function sessionCookieNames(
  cookies: { name: string; value: string }[],
): string[] {
  return cookies
    .filter((c) => SESSION_COOKIE.test(c.name) && c.value !== "")
    .map((c) => c.name);
}

test("a prefetch response does not re-issue the session cookie", async ({
  page,
}) => {
  await registerAndLogin(page);

  // Same headers the Next client router sends for a link prefetch.
  const response = await page.request.get("/en/account", {
    headers: {
      rsc: "1",
      "next-router-prefetch": "1",
      "sec-fetch-mode": "cors",
    },
  });
  expect(response.status()).toBe(200);
  const setCookies = response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie");
  expect(
    setCookies.filter((h) => SESSION_COOKIE.test(h.value)),
    "prefetch response must not carry a session Set-Cookie",
  ).toEqual([]);

  // Page navigations keep refreshing the session as before.
  const navigation = await page.request.get("/en/account", {
    headers: { "sec-fetch-mode": "navigate" },
  });
  expect(
    navigation
      .headersArray()
      .filter(
        (h) =>
          h.name.toLowerCase() === "set-cookie" && SESSION_COOKIE.test(h.value),
      ),
    "page navigation still refreshes the session cookie",
  ).toHaveLength(1);
});

test("logout is not undone by a prefetch that is still in flight", async ({
  page,
  baseURL,
}) => {
  await registerAndLogin(page);

  const proxy = await startHoldingProxy(new URL(baseURL!).port);
  try {
    // Cookies are shared across ports on the same host, so the session from
    // the login above is sent through the proxy too.
    await page.goto(`${proxy.origin}/en`);
    await expect
      .poll(() => proxy.held.length, "nav prefetches reached the server")
      .toBeGreaterThan(0);
    // Every prefetch has been rendered by the server with the old session;
    // only their responses are still held back.
    await expect.poll(() => proxy.pendingUpstream).toBe(0);
    proxy.stopHolding();

    await page.getByRole("button", { name: messages.nav.logout }).click();
    await expect(page).toHaveURL(`${proxy.origin}/en`);
    await expect(
      page.getByRole("link", { name: messages.nav.login }),
    ).toBeVisible();
    expect(sessionCookieNames(await page.context().cookies())).toEqual([]);

    // Now the stale prefetch responses arrive, after logout. Wait until the
    // browser has received every one of them before asserting.
    let delivered = 0;
    page.on("requestfinished", (request) => {
      if (request.headers()["next-router-prefetch"]) delivered++;
    });
    const expected = proxy.held.length;
    await proxy.releaseHeld();
    await expect.poll(() => delivered).toBe(expected);

    expect(
      sessionCookieNames(await page.context().cookies()),
      "session cookie must stay cleared after late prefetch responses",
    ).toEqual([]);
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en\/login/);
  } finally {
    await proxy.close();
  }
});

// A tiny reverse proxy in front of the app. Prefetch requests (the Next
// client router marks them with `Next-Router-Prefetch`) are forwarded at once
// but their responses are buffered until `releaseHeld()`, which models a
// slow network: the server rendered them with the old session, the browser
// only receives them later. Everything else is passed through untouched.
async function startHoldingProxy(upstreamPort: string) {
  let holding = true;
  let pendingUpstream = 0;
  const held: (() => Promise<void>)[] = [];

  const server = http.createServer((req, res) => {
    const isPrefetch = holding && !!req.headers["next-router-prefetch"];
    if (isPrefetch) pendingUpstream++;
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers: req.headers,
      },
      (upRes) => {
        if (!isPrefetch) {
          res.writeHead(upRes.statusCode ?? 502, upRes.headers);
          upRes.pipe(res);
          return;
        }
        const chunks: Buffer[] = [];
        upRes.on("data", (chunk: Buffer) => chunks.push(chunk));
        upRes.on("end", () => {
          held.push(
            () =>
              new Promise<void>((resolve) => {
                res.writeHead(upRes.statusCode ?? 502, upRes.headers);
                res.end(Buffer.concat(chunks), resolve);
              }),
          );
          pendingUpstream--;
        });
      },
    );
    upstream.on("error", () => {
      if (isPrefetch) pendingUpstream--;
      res.destroy();
    });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    held,
    get pendingUpstream() {
      return pendingUpstream;
    },
    stopHolding() {
      holding = false;
    },
    async releaseHeld() {
      await Promise.all(held.map((release) => release()));
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
