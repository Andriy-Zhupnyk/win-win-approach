import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

// Spec 0008 test plan: anonymous browse -> login -> create thread -> reply ->
// see it reflected in the list. Uses a unique email/title per run so it can
// re-run against the persistent dev database.
const LOCALES = [
  { code: "en", messages: en },
  { code: "uk", messages: uk },
] as const;

for (const { code, messages } of LOCALES) {
  test(`visitor browses, member logs in, starts a thread and replies (${code})`, async ({
    page,
  }) => {
    const runId = randomUUID().slice(0, 8);
    const email = `discuss-${code}-${runId}@test.winwinapproach.invalid`;
    const password = "a-strong-enough-password";
    const displayName = `Discusser ${runId}`;
    const title = `Thread ${runId}`;
    const t = messages.discussion;

    // Anonymous: can read the list, sees a log-in prompt and no form.
    const response = await page.goto(`/${code}/discussion`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: t.heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("login-prompt")).toBeVisible();
    await expect(page.getByRole("link", { name: t.newThread })).toHaveCount(0);

    await page.goto(`/${code}/discussion/new`);
    await expect(page.getByTestId("login-prompt")).toBeVisible();
    await expect(page.getByLabel(t.form.title)).toHaveCount(0);

    // Register + log in.
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

    // Start a thread.
    await page.goto(`/${code}/discussion`);
    await page.getByRole("link", { name: t.newThread }).click();
    await expect(page).toHaveURL(`/${code}/discussion/new`);
    await page.getByLabel(t.form.title).fill(title);
    await page.getByLabel(t.form.body).fill("Opening post text");
    await page.getByRole("button", { name: t.form.create }).click();
    await expect(page).toHaveURL(new RegExp(`/${code}/discussion/[^/]+$`));
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("post")).toHaveCount(1);

    // Reply.
    await page.getByLabel(t.reply.body).fill("My reply text");
    await page.getByRole("button", { name: t.reply.submit }).click();
    await expect(page.getByTestId("post")).toHaveCount(2);
    await expect(page.getByTestId("post").nth(1)).toContainText(
      "My reply text",
    );
    await expect(page.getByTestId("post").nth(1)).toContainText(displayName);

    // The list shows the thread with one reply. Select it by its unique
    // title: the en and uk tests run in parallel against the same database,
    // so "the first item" may be the other locale's thread.
    await page.goto(`/${code}/discussion`);
    const item = page.getByRole("listitem").filter({ hasText: title });
    await expect(item).toContainText(title);
    await expect(item).toContainText(displayName);
    await expect(item.getByTestId("reply-count")).toHaveText(
      code === "en" ? "1 reply" : "1 відповідь",
    );
  });
}

test("unknown thread id is a 404", async ({ page }) => {
  const response = await page.goto("/en/discussion/nope");
  expect(response?.status()).toBe(404);
});
