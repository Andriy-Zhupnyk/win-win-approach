// @vitest-environment node
//
// Unit tests for lib/rbac.ts — the single centralized place role checks are
// implemented (spec 0003). Covers `can`/`requireRole` across every role
// (including the implicit, unauthenticated "VISITOR") against gated
// actions, so this is the one file that needs updating if a role's
// capabilities ever change.
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  ForbiddenError,
  UnauthorizedError,
  can,
  getViewerRole,
  requireRole,
  ROLES,
} from "@/lib/rbac";

function sessionFor(role: "MEMBER" | "EXPERT" | "ADMIN"): Session {
  return {
    user: {
      id: `user-${role}`,
      role,
      email: `${role.toLowerCase()}@test.invalid`,
    },
    expires: new Date(Date.now() + 1000 * 60).toISOString(),
  } as Session;
}

describe("getViewerRole", () => {
  it("returns VISITOR for no session", () => {
    expect(getViewerRole(null)).toBe("VISITOR");
    expect(getViewerRole(undefined)).toBe("VISITOR");
  });

  it("returns the session's role when present", () => {
    expect(getViewerRole(sessionFor("ADMIN"))).toBe("ADMIN");
  });
});

describe("can", () => {
  it("is false for a visitor regardless of allowed roles", () => {
    expect(can(null, ROLES)).toBe(false);
  });

  it.each(ROLES)("is true for %s when %s is in the allowed list", (role) => {
    expect(can(sessionFor(role), [role])).toBe(true);
  });

  it("is false when the session's role isn't in the allowed list", () => {
    expect(can(sessionFor("MEMBER"), ["ADMIN"])).toBe(false);
    expect(can(sessionFor("EXPERT"), ["ADMIN"])).toBe(false);
  });
});

describe("requireRole", () => {
  it("throws UnauthorizedError for an unauthenticated visitor", () => {
    expect(() => requireRole(null, ["ADMIN"])).toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError for a logged-in user with the wrong role", () => {
    expect(() => requireRole(sessionFor("MEMBER"), ["ADMIN"])).toThrow(
      ForbiddenError,
    );
    expect(() => requireRole(sessionFor("EXPERT"), ["ADMIN"])).toThrow(
      ForbiddenError,
    );
  });

  it("returns the viewer's id/role when the role is allowed", () => {
    const session = sessionFor("ADMIN");
    expect(requireRole(session, ["ADMIN"])).toEqual({
      id: session.user.id,
      role: "ADMIN",
    });
  });

  it.each(ROLES)("allows %s through an any-authenticated-role gate", (role) => {
    const session = sessionFor(role);
    expect(requireRole(session, ROLES)).toEqual({ id: session.user.id, role });
  });
});
