import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

// Spec 0006 test plan: login -> edit display name -> reload -> see updated
// value. Also checks the translated validation error for an empty name.
const LOCALES = [
  { code: "en", messages: en },
  { code: "uk", messages: uk },
] as const;

for (const { code, messages } of LOCALES) {
  test(`edit display name on /account and see it persist (${code})`, async ({
    page,
  }) => {
    const runId = randomUUID().slice(0, 8);
    const email = `account-${code}-${runId}@test.winwinapproach.invalid`;
    const password = "a-strong-enough-password";

    await page.goto(`/${code}/register`);
    await page
      .getByLabel(messages.auth.register.displayNameLabel)
      .fill(`Original ${runId}`);
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

    await page.goto(`/${code}/account`);
    await expect(page.getByText(email)).toBeVisible();
    await expect(
      page.getByText(messages.account.roles.MEMBER, { exact: true }),
    ).toBeVisible();

    const nameInput = page.getByLabel(messages.account.displayNameLabel);
    const saveButton = page.getByRole("button", {
      name: messages.account.edit.save,
    });

    // Invalid: empty name shows a translated error and does not persist.
    await nameInput.fill("");
    await saveButton.click();
    await expect(
      page.getByText(messages.account.edit.errors.displayNameRequired),
    ).toBeVisible();
    await page.reload();
    await expect(nameInput).toHaveValue(`Original ${runId}`);

    // Valid: persists across a reload.
    const newName = `Renamed ${runId}`;
    await nameInput.fill(newName);
    await saveButton.click();
    await expect(page.getByText(messages.account.edit.saved)).toBeVisible();
    await page.reload();
    await expect(nameInput).toHaveValue(newName);
  });
}
