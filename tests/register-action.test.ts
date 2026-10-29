// @vitest-environment node
//
// Integration test for the registration Server Action against a real
// Postgres database — same rationale/conventions as
// tests/prisma.integration.test.ts (random run id per email, cleanup in
// afterAll). Covers the happy path (creates a MEMBER) and the main failure
// modes (duplicate email, weak password).
import { randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { registerAction } from "@/app/register/actions";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const emailFor = (name: string) =>
  `${name}-${runId}@test.winwinapproach.invalid`;
const createdEmails: string[] = [];

function formDataFor(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("registerAction", () => {
  it("creates a MEMBER user on the happy path and does not store the plaintext password", async () => {
    const email = emailFor("new-member");
    createdEmails.push(email);

    const result = await registerAction(
      {},
      formDataFor({
        email,
        password: "a-strong-enough-password",
        displayName: "New Member",
      }),
    );

    expect(result).toEqual({ success: true });

    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(created.role).toBe(Role.MEMBER);
    expect(created.passwordHash).not.toBeNull();
    expect(created.passwordHash).not.toBe("a-strong-enough-password");
  });

  it("rejects a duplicate email without creating a second user", async () => {
    const email = emailFor("duplicate");
    createdEmails.push(email);

    const first = await registerAction(
      {},
      formDataFor({
        email,
        password: "a-strong-enough-password",
        displayName: "First",
      }),
    );
    expect(first).toEqual({ success: true });

    const second = await registerAction(
      {},
      formDataFor({
        email,
        password: "another-strong-password",
        displayName: "Second",
      }),
    );
    expect(second.error).toMatch(/already exists/i);

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("rejects a password shorter than 8 characters without touching the database", async () => {
    const email = emailFor("weak-password");

    const result = await registerAction(
      {},
      formDataFor({ email, password: "short", displayName: "Weak Password" }),
    );

    expect(result.error).toMatch(/at least 8 characters/i);

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found).toBeNull();
  });
});
