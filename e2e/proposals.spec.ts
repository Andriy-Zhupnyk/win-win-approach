import { randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { test, expect, type Page } from "@playwright/test";
import en from "../messages/en.json";

// Spec 0009 test plan: member submits a proposal -> admin accepts it with a
// note -> member sees the accepted status and note. Accepting only creates a
// draft, so this never touches the single PUBLISHED slot.
const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const password = "a-strong-enough-password";
const adminEmail = `admin-prop-${runId}@test.winwinapproach.invalid`;
const memberEmail = `member-prop-${runId}@test.winwinapproach.invalid`;
const otherEmail = `other-prop-${runId}@test.winwinapproach.invalid`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const passwordHash = await hash(password, 4);
  for (const [email, name, role] of [
    [adminEmail, "Admin", Role.ADMIN],
    [memberEmail, "Member", Role.MEMBER],
    [otherEmail, "Other", Role.MEMBER],
  ] as const) {
    await prisma.user.create({
      data: {
        email,
        displayName: `${name} ${runId}`,
        role,
        passwordHash,
      },
    });
  }
});

test.afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: [adminEmail, memberEmail, otherEmail] } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  await prisma.proposal.deleteMany({ where: { submittedById: { in: ids } } });
  await prisma.informationVersion.deleteMany({
    where: { authorId: { in: ids } },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function login(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel(en.auth.login.emailLabel).fill(email);
  await page.getByLabel(en.auth.login.passwordLabel).fill(password);
  await page.getByRole("button", { name: en.auth.login.submit }).click();
  await expect(page).toHaveURL("/en");
}

test("member proposes, admin accepts with a note, member sees the outcome", async ({
  page,
}) => {
  const text = `Proposed wording ${runId}`;
  const note = `Thanks, accepted ${runId}`;

  await login(page, memberEmail);
  await page.goto("/en/proposals");
  await page.getByLabel(en.proposals.form.body).fill(text);
  await page.getByRole("button", { name: en.proposals.form.submit }).click();
  await expect(page.getByText(en.proposals.form.submitted)).toBeVisible();
  const mine = page.getByTestId("my-proposal").filter({ hasText: text });
  await expect(mine.getByTestId("proposal-status")).toHaveText(
    en.proposals.status.PENDING,
  );
  await page.context().clearCookies();

  await login(page, adminEmail);
  await page.goto("/en/admin");
  const queued = page.getByTestId("admin-proposal").filter({ hasText: text });
  await expect(queued).toBeVisible();
  await queued.getByLabel(en.admin.proposals.note).fill(note);
  await queued
    .getByRole("button", { name: en.admin.proposals.accept, exact: true })
    .click();
  await expect(queued).toHaveCount(0);
  await page.context().clearCookies();

  await login(page, memberEmail);
  await page.goto("/en/proposals");
  await expect(mine.getByTestId("proposal-status")).toHaveText(
    en.proposals.status.ACCEPTED,
  );
  await expect(mine.getByTestId("proposal-review-note")).toContainText(note);
  await page.context().clearCookies();

  // Another member never sees it.
  await login(page, otherEmail);
  await page.goto("/en/proposals");
  await expect(page.getByText(text)).toHaveCount(0);
});

test("visitors and plain members cannot reach the review UI", async ({
  page,
}) => {
  await page.goto("/en/proposals");
  await expect(page).toHaveURL(/\/en\/login/);
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/login/);

  await login(page, memberEmail);
  await page.goto("/en/admin");
  await expect(page).toHaveURL("/en/forbidden");
});
