import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

// Spec 0005 test plan. Relies on the fixtures from `npm run db:seed`
// (GS 0.1 archived Aug 2026, GS 0.2 published Sep 2026); CI seeds the
// database before running e2e.
const CASES = [
  {
    code: "en",
    messages: en,
    currentTitle: "Win-Win Approach — General Statement",
    archivedTitle: "Win-Win Approach — General Statement (first draft)",
    archivedDate: "August 15, 2026",
    currentDate: "September 15, 2026",
  },
  {
    code: "uk",
    messages: uk,
    currentTitle: "Win-Win Approach — Загальна заява",
    archivedTitle: "Win-Win Approach — Загальна заява (перша редакція)",
    archivedDate: "15 серпня 2026",
    currentDate: "15 вересня 2026",
  },
] as const;

for (const c of CASES) {
  test(`anonymous visitor reads current content, browses history and opens an archived version (${c.code})`, async ({
    page,
  }) => {
    const response = await page.goto(`/${c.code}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(`/${c.code}`);
    await expect(
      page.getByRole("heading", { name: c.currentTitle, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("archived-banner")).toHaveCount(0);

    await page
      .getByRole("link", { name: c.messages.information.versionHistory })
      .click();
    await expect(page).toHaveURL(`/${c.code}/information/versions`);

    // Newest first: GS 0.2 (current) before GS 0.1 (archived).
    const items = page.getByRole("listitem");
    await expect(items.nth(0)).toContainText("GS 0.2");
    await expect(items.nth(0)).toContainText(
      c.messages.information.statusCurrent,
    );
    await expect(items.nth(0)).toContainText(c.currentDate);
    await expect(items.nth(1)).toContainText("GS 0.1");
    await expect(items.nth(1)).toContainText(
      c.messages.information.statusArchived,
    );
    await expect(items.nth(1)).toContainText(c.archivedDate);

    await page.getByRole("link", { name: "GS 0.1" }).click();
    await expect(
      page.getByRole("heading", { name: c.archivedTitle }),
    ).toBeVisible();
    await expect(page.getByTestId("archived-banner")).toBeVisible();
  });
}

test("unknown version id is a 404", async ({ page }) => {
  const response = await page.goto("/en/information/versions/nope");
  expect(response?.status()).toBe(404);
});
