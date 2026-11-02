// @vitest-environment node
//
// Integration tests for role management (spec 0015) against a real Postgres
// database (same conventions as tests/admin-actions.test.ts). The session is
// mocked: `auth()` returns whichever JWT-like session the test selects, which
// may deliberately disagree with the role stored in the database.
import { randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const revalidate = vi.hoisted(() => vi.fn());
const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; role: string } },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/lib/auth", () => ({
  auth: async () => mockSession.current,
}));

import { changeRoleAction } from "@/app/[locale]/admin/users/actions";
import {
  ForbiddenError,
  requireFreshRole,
  UnauthorizedError,
} from "@/lib/rbac";
import {
  applyRoleChange,
  LastAdminError,
  listUsers,
  OwnRoleChangeError,
  parseRole,
} from "@/lib/users-admin";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);

let adminId: string;
let otherAdminId: string;
let targetId: string;
const createdIds: string[] = [];

async function createUser(name: string, role: Role) {
  const user = await prisma.user.create({
    data: {
      email: `${name}-${runId}@test.winwinapproach.invalid`,
      displayName: `User ${name}`,
      role,
    },
  });
  createdIds.push(user.id);
  return user;
}

function roleOf(id: string) {
  return prisma.user
    .findUniqueOrThrow({ where: { id }, select: { role: true } })
    .then((user) => user.role);
}

function signInAs(id: string, role: string) {
  mockSession.current = { user: { id, role } };
}

function formDataFor(fields: Record<string, string>, locale = "en") {
  const formData = new FormData();
  formData.set("locale", locale);
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const change = (userId: string, role: string, extra = {}, locale = "en") =>
  changeRoleAction({}, formDataFor({ userId, role, ...extra }, locale));

beforeAll(async () => {
  adminId = (await createUser("admin", Role.ADMIN)).id;
  otherAdminId = (await createUser("admin2", Role.ADMIN)).id;
  targetId = (await createUser("target", Role.MEMBER)).id;
});

beforeEach(async () => {
  mockSession.current = null;
  revalidate.mockClear();
  await prisma.user.updateMany({
    where: { id: { in: [adminId, otherAdminId] } },
    data: { role: Role.ADMIN },
  });
  await prisma.user.update({
    where: { id: targetId },
    data: { role: Role.MEMBER },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe("changeRoleAction", () => {
  it("lets an administrator move another user between every role", async () => {
    signInAs(adminId, Role.ADMIN);

    for (const role of [Role.EXPERT, Role.ADMIN, Role.MEMBER, Role.ADMIN]) {
      const result = await change(targetId, role);
      expect(result).toEqual({ success: true });
      expect(await roleOf(targetId)).toBe(role);
    }
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("logs actor, target and roles but no email", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    signInAs(adminId, Role.ADMIN);

    await change(targetId, Role.EXPERT);

    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toContain(`actor=${adminId}`);
    expect(line).toContain(`target=${targetId}`);
    expect(line).toContain("from=MEMBER");
    expect(line).toContain("to=EXPERT");
    expect(line).not.toContain("@");
  });

  it("refuses members, experts and visitors without changing anything", async () => {
    signInAs(targetId, Role.MEMBER);
    expect((await change(targetId, Role.ADMIN)).error).toMatch(/permission/i);

    const expert = await createUser("expert", Role.EXPERT);
    signInAs(expert.id, Role.EXPERT);
    expect((await change(targetId, Role.ADMIN)).error).toMatch(/permission/i);

    mockSession.current = null;
    expect((await change(targetId, Role.ADMIN)).error).toMatch(/logged in/i);

    expect(await roleOf(targetId)).toBe(Role.MEMBER);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("takes the acting user from the session, never from the form", async () => {
    // A member forging an admin's id in the form is still a member.
    signInAs(targetId, Role.MEMBER);
    const forged = await change(targetId, Role.ADMIN, { actorId: adminId });
    expect(forged.error).toMatch(/permission/i);
    expect(await roleOf(targetId)).toBe(Role.MEMBER);

    // An administrator naming someone else as "actor" is still the actor:
    // the self-change rule applies to the session user.
    signInAs(adminId, Role.ADMIN);
    const self = await change(adminId, Role.MEMBER, { actorId: otherAdminId });
    expect(self.error).toMatch(/own role/i);
    expect(await roleOf(adminId)).toBe(Role.ADMIN);
  });

  it("rejects a role outside the Role enum without changing anything", async () => {
    signInAs(adminId, Role.ADMIN);

    for (const role of ["SUPERADMIN", "admin", "VISITOR", ""]) {
      const result = await change(targetId, role);
      expect(result.error).toMatch(/valid role/i);
    }
    const missing = await changeRoleAction(
      {},
      formDataFor({ userId: targetId }),
    );
    expect(missing.error).toMatch(/valid role/i);
    expect(await roleOf(targetId)).toBe(Role.MEMBER);
  });

  it("refuses an administrator changing their own role", async () => {
    signInAs(adminId, Role.ADMIN);

    const result = await change(adminId, Role.MEMBER);

    expect(result.error).toMatch(/own role/i);
    expect(await roleOf(adminId)).toBe(Role.ADMIN);
  });

  it("reports an unknown user", async () => {
    signInAs(adminId, Role.ADMIN);

    const result = await change("does-not-exist", Role.EXPERT);

    expect(result.error).toMatch(/no longer exists/i);
  });

  it("translates errors for the form's locale", async () => {
    signInAs(adminId, Role.ADMIN);

    const result = await change(adminId, Role.MEMBER, {}, "uk");

    expect(result.error).toMatch(/власну роль/);
  });

  it("uses the database role, not the JWT: a demoted admin loses access on the very next request", async () => {
    // The token still says ADMIN (it was issued at sign-in)...
    signInAs(otherAdminId, Role.ADMIN);
    expect(await change(targetId, Role.EXPERT)).toEqual({ success: true });

    // ...another administrator demotes them...
    signInAs(adminId, Role.ADMIN);
    expect(await change(otherAdminId, Role.MEMBER)).toEqual({ success: true });

    // ...and the same, unchanged token no longer works.
    signInAs(otherAdminId, Role.ADMIN);
    expect((await change(targetId, Role.ADMIN)).error).toMatch(/permission/i);
    expect(await roleOf(targetId)).toBe(Role.EXPERT);
  });

  it("lets a freshly promoted user act even though the JWT still says MEMBER", async () => {
    await prisma.user.update({
      where: { id: targetId },
      data: { role: Role.ADMIN },
    });
    signInAs(targetId, Role.MEMBER);

    const result = await change(otherAdminId, Role.EXPERT);

    expect(result).toEqual({ success: true });
  });
});

describe("applyRoleChange", () => {
  class Rollback extends Error {}

  it("never demotes the last remaining administrator", async () => {
    let error: unknown;
    try {
      await prisma.$transaction(async (tx) => {
        // Inside a transaction that is rolled back, make `otherAdminId`
        // the only administrator in the whole database.
        await tx.user.updateMany({
          where: { role: Role.ADMIN, id: { not: otherAdminId } },
          data: { role: Role.MEMBER },
        });
        try {
          await applyRoleChange(tx, {
            actorId: targetId,
            targetId: otherAdminId,
            role: Role.MEMBER,
          });
        } catch (caught) {
          error = caught;
        }
        expect(await tx.user.count({ where: { role: Role.ADMIN } })).toBe(1);
        throw new Rollback();
      });
    } catch (caught) {
      if (!(caught instanceof Rollback)) {
        throw caught;
      }
    }

    expect(error).toBeInstanceOf(LastAdminError);
    expect(await roleOf(otherAdminId)).toBe(Role.ADMIN);
    expect(await roleOf(adminId)).toBe(Role.ADMIN);
  });

  it("allows demoting an administrator while another one remains", async () => {
    const result = await prisma.$transaction((tx) =>
      applyRoleChange(tx, {
        actorId: adminId,
        targetId: otherAdminId,
        role: Role.EXPERT,
      }),
    );

    expect(result).toEqual({ from: Role.ADMIN, to: Role.EXPERT });
    expect(await roleOf(otherAdminId)).toBe(Role.EXPERT);
  });

  it("refuses a self-change", async () => {
    await expect(
      prisma.$transaction((tx) =>
        applyRoleChange(tx, {
          actorId: adminId,
          targetId: adminId,
          role: Role.ADMIN,
        }),
      ),
    ).rejects.toBeInstanceOf(OwnRoleChangeError);
  });
});

describe("requireFreshRole", () => {
  it("decides on the stored role, not the session's", async () => {
    const asAdminToken = { user: { id: targetId, role: Role.ADMIN } };
    await expect(
      requireFreshRole(asAdminToken, ["ADMIN"]),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const asMemberToken = { user: { id: adminId, role: Role.MEMBER } };
    await expect(requireFreshRole(asMemberToken, ["ADMIN"])).resolves.toEqual({
      id: adminId,
      role: Role.ADMIN,
    });
  });

  it("treats no session and a deleted user as logged out", async () => {
    await expect(requireFreshRole(null, ["ADMIN"])).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(
      requireFreshRole({ user: { id: "gone", role: Role.ADMIN } }, ["ADMIN"]),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("parseRole and listUsers", () => {
  it("accepts exactly the Role enum values", () => {
    expect(parseRole("EXPERT")).toBe(Role.EXPERT);
    expect(() => parseRole("expert")).toThrow();
    expect(() => parseRole(null)).toThrow();
  });

  it("lists users newest first, capped, with only safe columns", async () => {
    const users = await listUsers();

    expect(users.length).toBeGreaterThan(0);
    expect(users.length).toBeLessThanOrEqual(100);
    expect(Object.keys(users[0]!).sort()).toEqual([
      "createdAt",
      "displayName",
      "email",
      "id",
      "role",
    ]);
    for (let i = 1; i < users.length; i++) {
      expect(users[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
        users[i]!.createdAt.getTime(),
      );
    }
  });
});
