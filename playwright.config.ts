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
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
