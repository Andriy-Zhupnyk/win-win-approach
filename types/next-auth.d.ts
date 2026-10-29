import type { Role } from "@prisma/client";
import type { DefaultSession, DefaultUser } from "next-auth";

// Module augmentation: adds our Prisma `Role` and the user id to Auth.js's
// Session/User/JWT types so `session.user.role` etc. are typed everywhere
// (lib/rbac.ts, middleware.ts, server actions) instead of needing `as`
// casts at every call site.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
