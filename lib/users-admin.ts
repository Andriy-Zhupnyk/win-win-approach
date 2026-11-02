// Data access for the admin user list and role changes (spec 0015). Callers
// (the Server Action and the page) must have already passed
// `requireFreshRole(session, ["ADMIN"])` from lib/rbac.ts; this file only
// enforces the data invariants (no self-change, never demote the last admin).
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const USER_LIST_LIMIT = 100;

export class OwnRoleChangeError extends Error {
  constructor() {
    super("An administrator cannot change their own role.");
    this.name = "OwnRoleChangeError";
  }
}

export class LastAdminError extends Error {
  constructor() {
    super("The last administrator cannot be demoted.");
    this.name = "LastAdminError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

export class InvalidRoleError extends Error {
  constructor() {
    super("Unknown role.");
    this.name = "InvalidRoleError";
  }
}

/** Narrows untrusted input to a value of the Prisma `Role` enum. */
export function parseRole(value: unknown): Role {
  const match = Object.values(Role).find((role) => role === value);
  if (!match) {
    throw new InvalidRoleError();
  }
  return match;
}

/** Newest registrations first, capped at `USER_LIST_LIMIT` rows. */
export function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: USER_LIST_LIMIT,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });
}

/**
 * Changes `targetId`'s role. Must run inside a transaction (pass the
 * transaction client) so the last-admin check and the update are atomic; see
 * `changeUserRole`. Returns the previous and new role for the audit log.
 */
export async function applyRoleChange(
  db: Prisma.TransactionClient,
  input: { actorId: string; targetId: string; role: Role },
): Promise<{ from: Role; to: Role }> {
  if (input.actorId === input.targetId) {
    throw new OwnRoleChangeError();
  }
  const target = await db.user.findUnique({
    where: { id: input.targetId },
    select: { role: true },
  });
  if (!target) {
    throw new UserNotFoundError();
  }
  if (target.role === Role.ADMIN && input.role !== Role.ADMIN) {
    const admins = await db.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) {
      throw new LastAdminError();
    }
  }
  if (target.role !== input.role) {
    await db.user.update({
      where: { id: input.targetId },
      data: { role: input.role },
    });
  }
  return { from: target.role, to: input.role };
}

/**
 * Serializable, so two administrators demoting each other at the same moment
 * cannot both pass the last-admin check; the loser gets a serialization
 * failure (Prisma P2034), which the caller reports as "try again".
 */
export function changeUserRole(input: {
  actorId: string;
  targetId: string;
  role: Role;
}) {
  return prisma.$transaction((tx) => applyRoleChange(tx, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

export function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}
