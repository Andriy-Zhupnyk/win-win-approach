import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

// Full Auth.js (NextAuth v5) config. `handlers`/`auth`/`signIn`/`signOut`
// below are used from Server Components, Server Actions and the route
// handler in app/api/auth/[...nextauth]/route.ts — never imported from
// middleware.ts, which uses the lighter `authConfig` instead (Prisma /
// bcrypt are not edge-safe).
//
// Session strategy is explicitly "jwt": the Credentials provider does not
// support database sessions (Auth.js persists an Account/Session row only
// for provider-brokered sign-ins, never for Credentials), so this must be
// set even though an adapter is configured.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          // No user, or an account with no password set (e.g. a future
          // OAuth-only user) — reject either way without distinguishing,
          // so the error message to the client stays generic.
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
        };
      },
    }),
  ],
});
