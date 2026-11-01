import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

// Spec 0003 test plan: register -> login -> attempt /admin as member
// (redirected) -> logout. Uses a unique email per run so this can be
// re-run against the persistent local dev database without colliding.
//
// Spec 0004: the whole flow is parameterized over both locales and
// asserts on the actual translated copy (imported straight from
// messages/*.json) instead of hardcoded English strings, so it both
// exercises the locale-prefixed routes and would fail if the UI ever
// stopped actually using the translations it declares.
const LOCALES = [
  { code: "en", messages: en },
  { code: "uk", messages: uk },
] as const;

for (const { code, messages } of LOCALES) {
  test(`register, login, member is forbidden from /admin, logout (${code})`, async ({
    page,
  }) => {
    const runId = randomUUID().slice(0, 8);
    const email = `member-${code}-${runId}@test.winwinapproach.invalid`;
    const password = "a-strong-enough-password";
    const displayName = `Test Member ${runId}`;

    await page.goto(`/${code}/register`);
    await page
      .getByLabel(messages.auth.register.displayNameLabel)
      .fill(displayName);
    await page.getByLabel(messages.auth.register.emailLabel).fill(email);
    await page.getByLabel(messages.auth.register.passwordLabel).fill(password);
    await page
      .getByRole("button", { name: messages.auth.register.submit })
      .click();
    await expect(page.getByText(messages.auth.register.success)).toBeVisible();

    await page.goto(`/${code}/login`);
    await page.getByLabel(messages.auth.login.emailLabel).fill(email);
    await page.getByLabel(messages.auth.login.passwordLabel).fill(password);
    await page
      .getByRole("button", { name: messages.auth.login.submit })
      .click();
    await expect(page).toHaveURL(`/${code}`);
    // The nav shows the session user's display name (falls back to email).
    await expect(page.getByText(displayName)).toBeVisible();

    // A freshly registered MEMBER must not see the Admin nav link, and must
    // be redirected away from /admin itself (middleware.ts), not get a
    // crash or a silent no-op.
    await expect(
      page.getByRole("link", { name: messages.nav.admin }),
    ).toHaveCount(0);
    await page.goto(`/${code}/admin`);
    await expect(page).toHaveURL(`/${code}/forbidden`);
    await expect(
      page.getByRole("heading", { name: messages.forbidden.heading }),
    ).toBeVisible();

    await page.goto(`/${code}`);
    // Let the nav-link RSC prefetches finish first. Each one renders with
    // the old session and re-issues the session cookie, so one still in
    // flight when logout clears the cookie can resurrect it (observed against
    // a production build, where Next prefetches links).
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: messages.nav.logout }).click();
    await expect(page).toHaveURL(`/${code}`);
    await expect(
      page.getByRole("link", { name: messages.nav.login }),
    ).toBeVisible();

    // And now that the session is gone, /account redirects to /login
    // instead of rendering.
    await page.goto(`/${code}/account`);
    await expect(page).toHaveURL(new RegExp(`/${code}/login`));
  });
}
