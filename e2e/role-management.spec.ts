import { randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";

// Spec 0015 test plan: an administrator promotes a member to expert (who then
// sees the Proposals link), a member cannot open /admin/users, the safety
// rules show translated errors, and a demoted administrator's still-open
// session loses access on the next request.
const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const password = "a-strong-enough-password";
const email = (name: string) =>
  `${name}-roles-${runId}@test.winwinapproach.invalid`;
const adminEmail = email("admin");
const secondAdminEmail = email("admin2");
const memberEmail = email("member");
const promoteeEmail = email("promotee");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const passwordHash = await hash(password, 4);
  for (const [address, name, role] of [
    [adminEmail, "Admin", Role.ADMIN],
    [secondAdminEmail, "Admin2", Role.ADMIN],
    [memberEmail, "Member", Role.MEMBER],
    [promoteeEmail, "Promotee", Role.MEMBER],
  ] as const) {
    await prisma.user.create({
      data: {
        email: address,
        displayName: `${name} ${runId}`,
        role,
        passwordHash,
      },
    });
  }
});

test.afterAll(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [adminEmail, secondAdminEmail, memberEmail, promoteeEmail],
      },
    },
  });
  await prisma.$disconnect();
});

async function login(page: Page, address: string, code: "en" | "uk" = "en") {
  const messages = code === "en" ? en : uk;
  await page.goto(`/${code}/login`);
  await page.getByLabel(messages.auth.login.emailLabel).fill(address);
  await page.getByLabel(messages.auth.login.passwordLabel).fill(password);
  await page.getByRole("button", { name: messages.auth.login.submit }).click();
  await expect(page).toHaveURL(`/${code}`);
}

async function loggedInPage(browser: Browser, address: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, address);
  return page;
}

test("admin promotes a member to expert, who then sees the Proposals link", async ({
  page,
  browser,
}) => {
  await login(page, adminEmail);
  await page.goto("/en/admin");
  await page.getByRole("link", { name: en.admin.usersLink }).click();
  await expect(page).toHaveURL("/en/admin/users");

  const row = page.getByTestId(`user-row-${promoteeEmail}`);
  await expect(row.getByTestId("user-role")).toHaveText(
    en.admin.users.roles.MEMBER,
  );
  await row
    .getByLabel(en.admin.users.roleSelect)
    .selectOption({ label: en.admin.users.roles.EXPERT });
  await row.getByRole("button", { name: en.admin.users.save }).click();
  await expect(row.getByText(en.admin.users.saved)).toBeVisible();
  await expect(row.getByTestId("user-role")).toHaveText(
    en.admin.users.roles.EXPERT,
  );
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { email: promoteeEmail } }))
      .role,
  ).toBe(Role.EXPERT);

  const expert = await loggedInPage(browser, promoteeEmail);
  await expect(
    expert.getByRole("link", { name: en.nav.proposals }),
  ).toBeVisible();
  await expert.goto("/en/account");
  await expect(expert.getByText(en.account.roles.EXPERT)).toBeVisible();
  await expert.context().close();
});

test("an administrator cannot change their own role", async ({ page }) => {
  await login(page, adminEmail);
  await page.goto("/en/admin/users");

  const row = page.getByTestId(`user-row-${adminEmail}`);
  await row
    .getByLabel(en.admin.users.roleSelect)
    .selectOption({ label: en.admin.users.roles.MEMBER });
  await row.getByRole("button", { name: en.admin.users.save }).click();
  await expect(row.getByRole("alert")).toHaveText(
    en.admin.users.errors.ownRole,
  );
  await expect(row.getByTestId("user-role")).toHaveText(
    en.admin.users.roles.ADMIN,
  );
});

test("a demoted administrator loses access on the next request", async ({
  page,
  browser,
}) => {
  const second = await loggedInPage(browser, secondAdminEmail);
  await second.goto("/en/admin/users");
  await expect(
    second.getByRole("heading", { name: en.admin.users.heading }),
  ).toBeVisible();

  await login(page, adminEmail);
  await page.goto("/en/admin/users");
  const row = page.getByTestId(`user-row-${secondAdminEmail}`);
  await row
    .getByLabel(en.admin.users.roleSelect)
    .selectOption({ label: en.admin.users.roles.MEMBER });
  await row.getByRole("button", { name: en.admin.users.save }).click();
  await expect(row.getByTestId("user-role")).toHaveText(
    en.admin.users.roles.MEMBER,
  );

  // Same session cookie (its token still says ADMIN), new request.
  await second.goto("/en/admin/users");
  await expect(second).toHaveURL("/en/forbidden");
  await second.goto("/en/admin");
  await expect(second).toHaveURL("/en/forbidden");
  await second.context().close();
});

test("a member cannot open /admin/users and a visitor is sent to log in", async ({
  page,
}) => {
  await page.goto("/en/admin/users");
  await expect(page).toHaveURL(/\/en\/login/);

  await login(page, memberEmail);
  await page.goto("/en/admin/users");
  await expect(page).toHaveURL("/en/forbidden");

  await page.context().clearCookies();
  await login(page, memberEmail, "uk");
  await page.goto("/uk/admin/users");
  await expect(page).toHaveURL("/uk/forbidden");
});

test("the Ukrainian users page is translated", async ({ page }) => {
  await login(page, adminEmail, "uk");
  await page.goto("/uk/admin/users");
  await expect(
    page.getByRole("heading", { name: uk.admin.users.heading }),
  ).toBeVisible();
  await expect(
    page.getByTestId(`user-row-${memberEmail}`).getByTestId("user-role"),
  ).toHaveText(uk.admin.users.roles.MEMBER);
});
