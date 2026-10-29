import { test, expect } from "@playwright/test";

test("home page renders the placeholder content", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Win-Win Approach" }),
  ).toBeVisible();
});
