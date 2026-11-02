import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

// Spec 0014: the public demo's register page shows a translated privacy
// notice (what is stored, that it is a demo, how to ask for deletion).
const LOCALES = [
  { code: "en", messages: en },
  { code: "uk", messages: uk },
] as const;

for (const { code, messages } of LOCALES) {
  test(`register page shows the privacy notice (${code})`, async ({ page }) => {
    await page.goto(`/${code}/register`);

    await expect(
      page.getByRole("heading", {
        name: messages.auth.register.privacy.heading,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(messages.auth.register.privacy.body),
    ).toBeVisible();
  });
}
