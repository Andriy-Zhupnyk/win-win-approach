import { test, expect } from "@playwright/test";
import uk from "../messages/uk.json";

// The home page is the public Information page (spec 0005); its content
// comes from the seeded GS 0.2 version (see e2e/information.spec.ts).
const LOCALES = [
  { code: "en", title: "Win-Win Approach — General Statement" },
  { code: "uk", title: "Win-Win Approach — Загальна заява" },
] as const;

for (const { code, title } of LOCALES) {
  test(`home page renders the Information heading (${code})`, async ({
    page,
  }) => {
    await page.goto(`/${code}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  });
}

test("root path redirects to a supported locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(uk|en)$/);
});

test("locale switcher changes the page language and persists across navigation", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(
    page.getByRole("heading", { name: LOCALES[0].title, exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "UK" }).click();
  await expect(page).toHaveURL("/uk");
  await expect(
    page.getByRole("heading", { name: LOCALES[1].title, exact: true }),
  ).toBeVisible();

  // The switch to `uk` isn't just a one-off navigation — it must persist
  // when navigating to another page too.
  await page.getByRole("link", { name: uk.nav.login }).click();
  await expect(page).toHaveURL("/uk/login");
  await expect(
    page.getByRole("heading", { name: uk.auth.login.heading }),
  ).toBeVisible();
});
