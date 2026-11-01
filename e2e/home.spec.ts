import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

const LOCALES = [
  { code: "en", messages: en },
  { code: "uk", messages: uk },
] as const;

for (const { code, messages } of LOCALES) {
  test(`home page renders the translated heading (${code})`, async ({
    page,
  }) => {
    await page.goto(`/${code}`);
    await expect(
      page.getByRole("heading", { name: messages.home.title }),
    ).toBeVisible();
    await expect(page.getByText(messages.home.subtitle)).toBeVisible();
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
    page.getByRole("heading", { name: en.home.title }),
  ).toBeVisible();

  await page.getByRole("link", { name: "UK" }).click();
  await expect(page).toHaveURL("/uk");
  await expect(
    page.getByRole("heading", { name: uk.home.title }),
  ).toBeVisible();
  await expect(page.getByText(uk.home.subtitle)).toBeVisible();

  // The switch to `uk` isn't just a one-off navigation — it must persist
  // when navigating to another page too.
  await page.getByRole("link", { name: uk.nav.login }).click();
  await expect(page).toHaveURL("/uk/login");
  await expect(
    page.getByRole("heading", { name: uk.auth.login.heading }),
  ).toBeVisible();
});
