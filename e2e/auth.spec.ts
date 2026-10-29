import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

// Spec 0003 test plan: register -> login -> attempt /admin as member
// (redirected) -> logout. Uses a unique email per run so this can be
// re-run against the persistent local dev database without colliding.
test("register, login, member is forbidden from /admin, logout", async ({
  page,
}) => {
  const runId = randomUUID().slice(0, 8);
  const email = `member-${runId}@test.winwinapproach.invalid`;
  const password = "a-strong-enough-password";
  const displayName = `Test Member ${runId}`;

  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText("Account created.")).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/");
  // The nav shows the session user's display name (falls back to email).
  await expect(page.getByText(displayName)).toBeVisible();

  // A freshly registered MEMBER must not see the Admin nav link, and must
  // be redirected away from /admin itself (middleware.ts), not get a
  // crash or a silent no-op.
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL("/forbidden");
  await expect(page.getByRole("heading", { name: "Forbidden" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

  // And now that the session is gone, /account redirects to /login instead
  // of rendering.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});
