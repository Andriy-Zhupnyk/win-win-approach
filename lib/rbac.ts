import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

// Centralized RBAC helper (spec 0003). This is the ONLY place role checks
// are implemented — every server action / route handler / page that needs
// a role check must go through `requireRole`, `can`, or `requirePageRole`
// below rather than comparing `session.user.role` inline.
//
// Only four flat roles exist (VISITOR is implicit/not stored, see
// prisma/schema.prisma). Per spec 0003's non-goals, there is no
// per-resource/fine-grained permission system — `can`/`requireRole` take a
// list of roles allowed to perform whatever the caller is about to do.

export const ROLES = [
  "MEMBER",
  "EXPERT",
  "ADMIN",
] as const satisfies readonly Role[];

/** The viewer's role, including the implicit, never-persisted "VISITOR". */
export type ViewerRole = Role | "VISITOR";

type SessionLike = Pick<Session, "user"> | null | undefined;

export class UnauthorizedError extends Error {
  constructor(message = "You must be logged in to do this.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do this.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Resolves a session to a role, defaulting to the implicit "VISITOR". */
export function getViewerRole(session: SessionLike): ViewerRole {
  return session?.user?.role ?? "VISITOR";
}

/**
 * Non-throwing check, for conditional rendering (e.g. hiding the "Admin"
 * nav link for non-admins) rather than guarding a mutation.
 */
export function can(
  session: SessionLike,
  allowedRoles: readonly Role[],
): boolean {
  const role = getViewerRole(session);
  return role !== "VISITOR" && allowedRoles.includes(role);
}

/**
 * Guards a server action / route handler. Throws `UnauthorizedError` if
 * there's no session, `ForbiddenError` if the session's role isn't in
 * `allowedRoles`, otherwise returns the authenticated viewer's id/role.
 */
export function requireRole(
  session: SessionLike,
  allowedRoles: readonly Role[],
): { id: string; role: Role } {
  const role = getViewerRole(session);
  if (role === "VISITOR") {
    throw new UnauthorizedError();
  }
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError();
  }
  // Safe: role !== "VISITOR" above means session.user is defined.
  return { id: session!.user!.id, role };
}

/**
 * Page-level counterpart of `requireRole`, for Server Components (e.g.
 * app/admin/page.tsx). Reads the session itself and redirects instead of
 * throwing — a redirect, not a crash, is what the spec asks for — but the
 * role comparison itself is still delegated to `requireRole`, so this file
 * remains the only place that compares a role.
 *
 * This is a defense-in-depth check: `middleware.ts` already redirects
 * unauthenticated/wrong-role requests away from these routes, but per spec
 * 0003 the route itself must not rely on middleware alone.
 */
export async function requirePageRole(allowedRoles: readonly Role[]) {
  // Deferred import: lib/auth.ts pulls in next-auth's full runtime (and
  // transitively bcrypt/Prisma), which only resolves cleanly inside
  // Next.js's own module graph — not under Vitest. Deferring it here keeps
  // `can`/`requireRole`/`getViewerRole` importable as plain, fast unit
  // tests (see tests/rbac.test.ts) without touching any of that.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  try {
    return requireRole(session, allowedRoles);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (error instanceof ForbiddenError) {
      redirect("/forbidden");
    }
    throw error;
  }
}
