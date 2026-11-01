import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe Auth.js config shared between `middleware.ts` and the full
// config in `lib/auth.ts`. Deliberately has no Prisma adapter and no
// providers that touch Node-only APIs (bcrypt), so it can run in
// middleware regardless of runtime. `providers` is filled in by
// `lib/auth.ts`, which spreads this config and adds the Credentials
// provider.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // Runs on every request that touches the session; only has `user` on
    // the initial sign-in, so carry id/role forward into the token itself.
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
      }
      // Spec 0006: after a profile edit the action calls `unstable_update`
      // so the display name shown in the nav doesn't stay stale. Only the
      // name is accepted here; id/role must never be client-influenced.
      if (trigger === "update" && typeof session?.user?.name === "string") {
        token.name = session.user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
