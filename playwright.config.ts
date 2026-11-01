import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// e2e/admin.spec.ts talks to the database directly. Locally the URL lives in
// .env.local; in CI DATABASE_URL is already set and this is a no-op.
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /admin\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Replaces the single PUBLISHED Information version, so it must not
      // overlap with the specs that read it: run after the project above.
      name: "chromium-admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["chromium"],
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Serve a production build, not `next dev`: the dev server compiles each
    // route on its first request, and with parallel workers that on-demand
    // compilation blows Playwright's 5s expect timeout and intermittently
    // fails requests (spec 0012). A production build has nothing left to
    // compile, so the suite behaves the same cold or warm. The build time
    // counts against the webServer timeout below.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    // Never reuse a running server: a leftover `next dev` or an older build
    // on this port would silently test stale or differently-behaving code.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      // Auth.js rejects non-Vercel hosts in production unless told to trust
      // them; the e2e server is reached as 127.0.0.1.
      AUTH_TRUST_HOST: "true",
    },
  },
});
