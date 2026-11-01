import { randomUUID } from "node:crypto";
import { InformationStatus, PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { test, expect, type Page } from "@playwright/test";
import en from "../messages/en.json";
import uk from "../messages/uk.json";
import { takePublishedSlot } from "../tests/helpers/published-slot";

// Spec 0007 test plan: admin creates a draft (public page unchanged), then
// publishes it (public page + version history updated); a member cannot reach
// /admin. This file mutates the single PUBLISHED slot, so it runs in its own
// Playwright project after all other specs (see playwright.config.ts) and
// restores the original published version afterwards.
const LOCALES = [
  { code: "en", messages: en },
  { code: "uk", messages: uk },
] as const;

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const password = "a-strong-enough-password";
const adminEmail = `admin-e2e-${runId}@test.winwinapproach.invalid`;
const memberEmail = `member-e2e-${runId}@test.winwinapproach.invalid`;

let adminId: string;
let restorePublished: () => Promise<void>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  restorePublished = await takePublishedSlot(prisma);
  const passwordHash = await hash(password, 4);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      displayName: `Admin ${runId}`,
      role: Role.ADMIN,
      passwordHash,
    },
  });
  adminId = admin.id;
  await prisma.user.create({
    data: {
      email: memberEmail,
      displayName: `Member ${runId}`,
      role: Role.MEMBER,
      passwordHash,
    },
  });
});

test.beforeEach(async () => {
  await prisma.informationVersion.deleteMany({ where: { authorId: adminId } });
  await prisma.informationVersion.create({
    data: {
      versionLabel: `BASE ${runId}`,
      title: `Base title ${runId}`,
      body: "Base body",
      status: InformationStatus.PUBLISHED,
      publishedAt: new Date("2030-01-01T00:00:00Z"),
      authorId: adminId,
    },
  });
});

test.afterAll(async () => {
  await prisma.informationVersion.deleteMany({ where: { authorId: adminId } });
  await prisma.user.deleteMany({
    where: { email: { in: [adminEmail, memberEmail] } },
  });
  await restorePublished();
  await prisma.$disconnect();
});

async function login(
  page: Page,
  code: "en" | "uk",
  messages: typeof en,
  email: string,
) {
  await page.goto(`/${code}/login`);
  await page.getByLabel(messages.auth.login.emailLabel).fill(email);
  await page.getByLabel(messages.auth.login.passwordLabel).fill(password);
  await page.getByRole("button", { name: messages.auth.login.submit }).click();
  await expect(page).toHaveURL(`/${code}`);
}

for (const { code, messages } of LOCALES) {
  test(`admin saves a draft, then publishes it (${code})`, async ({ page }) => {
    const label = `E2E ${code} ${runId}`;
    const title = `Draft title EN ${code} ${runId}`;
    const titleUk = `Draft title UK ${code} ${runId}`;
    const publicTitle = code === "uk" ? titleUk : title;
    const m = messages.admin;

    await login(page, code, messages, adminEmail);
    await page.goto(`/${code}/admin`);
    await expect(
      page.getByRole("heading", { name: m.heading, exact: true }),
    ).toBeVisible();

    await page.getByLabel(m.form.versionLabel).fill(label);
    await page.getByLabel(m.form.title, { exact: true }).fill(title);
    await page.getByLabel(m.form.body, { exact: true }).fill("Draft body");
    await page.getByLabel(m.form.titleUk, { exact: true }).fill(titleUk);
    await page.getByLabel(m.form.bodyUk, { exact: true }).fill("Чернетка");
    await page.getByRole("button", { name: m.form.saveDraft }).click();
    await expect(page.getByText(m.form.savedDraft)).toBeVisible();

    const row = page.getByTestId(`admin-version-${label}`);
    await expect(row).toContainText(m.status.DRAFT);

    // The draft is private: the public page still shows the base version.
    await page.goto(`/${code}`);
    await expect(
      page.getByRole("heading", { name: `Base title ${runId}` }),
    ).toBeVisible();
    await expect(page.getByText(publicTitle)).toHaveCount(0);

    // Publish it from the list.
    await page.goto(`/${code}/admin`);
    await page
      .getByTestId(`admin-version-${label}`)
      .getByRole("button", { name: m.list.publish })
      .click();
    await expect(row).toContainText(m.status.PUBLISHED);
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect(page.getByTestId(`admin-version-BASE ${runId}`)).toContainText(
      m.status.ARCHIVED,
    );

    // Public page shows the new content; history shows the old as archived.
    await page.goto(`/${code}`);
    await expect(
      page.getByRole("heading", { name: publicTitle }),
    ).toBeVisible();
    await page.goto(`/${code}/information/versions`);
    const items = page.getByRole("listitem");
    await expect(items.filter({ hasText: label })).toContainText(
      messages.information.statusCurrent,
    );
    await expect(items.filter({ hasText: `BASE ${runId}` })).toContainText(
      messages.information.statusArchived,
    );
  });
}

test("a member cannot open /admin and a visitor is sent to log in", async ({
  page,
}) => {
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/login/);

  await login(page, "en", en, memberEmail);
  await page.goto("/en/admin");
  await expect(page).toHaveURL("/en/forbidden");
});
