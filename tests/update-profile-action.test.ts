// @vitest-environment node
//
// Integration test for the update-profile Server Action against a real
// Postgres database (same conventions as tests/register-action.test.ts).
// The session is mocked: `auth()` returns whichever user the test selects.
import { randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; role: string } },
}));
const updateSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: async () => mockSession.current,
  unstable_update: updateSession,
}));

import { updateProfileAction } from "@/app/[locale]/account/actions";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const createdEmails: string[] = [];

async function createUser(name: string) {
  const email = `${name}-${runId}@test.winwinapproach.invalid`;
  createdEmails.push(email);
  return prisma.user.create({
    data: { email, displayName: `Original ${name}`, role: Role.MEMBER },
  });
}

function formDataFor(displayName: string, extra: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("displayName", displayName);
  for (const [key, value] of Object.entries(extra)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  mockSession.current = null;
  updateSession.mockClear();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("updateProfileAction", () => {
  it("updates the signed-in user's display name (trimmed) and refreshes the session", async () => {
    const user = await createUser("editor");
    mockSession.current = { user: { id: user.id, role: "MEMBER" } };

    const result = await updateProfileAction({}, formDataFor("  New Name  "));

    expect(result).toEqual({ success: true, displayName: "New Name" });
    const reloaded = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(reloaded.displayName).toBe("New Name");
    expect(updateSession).toHaveBeenCalledWith({ user: { name: "New Name" } });
  });

  it("rejects an empty name without persisting", async () => {
    const user = await createUser("empty");
    mockSession.current = { user: { id: user.id, role: "MEMBER" } };

    const result = await updateProfileAction({}, formDataFor("   "));

    expect(result.error).toMatch(/required/i);
    const reloaded = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(reloaded.displayName).toBe("Original empty");
  });

  it("rejects an overly long name without persisting", async () => {
    const user = await createUser("long");
    mockSession.current = { user: { id: user.id, role: "MEMBER" } };

    const result = await updateProfileAction({}, formDataFor("x".repeat(81)));

    expect(result.error).toMatch(/at most 80/i);
    const reloaded = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(reloaded.displayName).toBe("Original long");
  });

  it("translates the validation error to the requested locale", async () => {
    const user = await createUser("uk");
    mockSession.current = { user: { id: user.id, role: "MEMBER" } };

    const result = await updateProfileAction(
      {},
      formDataFor("", { locale: "uk" }),
    );

    expect(result.error).toMatch(/Вкажіть/);
  });

  it("requires a session and changes nothing when logged out", async () => {
    const user = await createUser("anon");

    const result = await updateProfileAction({}, formDataFor("Hacker"));

    expect(result.error).toMatch(/logged in/i);
    const reloaded = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(reloaded.displayName).toBe("Original anon");
  });

  it("only ever edits the session user's own row, ignoring a forged userId field", async () => {
    const me = await createUser("me");
    const other = await createUser("other");
    mockSession.current = { user: { id: me.id, role: "MEMBER" } };

    await updateProfileAction(
      {},
      formDataFor("Mine", { userId: other.id, id: other.id, role: "ADMIN" }),
    );

    const [reloadedMe, reloadedOther] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: me.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: other.id } }),
    ]);
    expect(reloadedMe.displayName).toBe("Mine");
    expect(reloadedMe.role).toBe(Role.MEMBER);
    expect(reloadedOther.displayName).toBe("Original other");
  });
});
