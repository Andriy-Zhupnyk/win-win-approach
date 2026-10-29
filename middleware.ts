import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-level route protection for spec 0003. Uses the lightweight
// `authConfig` (no Prisma adapter, no bcrypt) so this runs regardless of
// middleware runtime. This is in ADDITION to, not instead of, the
// server-side `requirePageRole`/`requireRole` checks in the actual
// page/action — see lib/rbac.ts.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");

  if (!isAccountRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/forbidden", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
