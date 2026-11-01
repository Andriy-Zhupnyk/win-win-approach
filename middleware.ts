import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

// Edge-level route protection for spec 0003, now composed with spec 0004's
// locale routing. Uses the lightweight `authConfig` (no Prisma adapter, no
// bcrypt) so this runs regardless of middleware runtime. This is in
// ADDITION to, not instead of, the server-side `requirePageRole`/
// `requireRole` checks in the actual page/action — see lib/rbac.ts.
const { auth } = NextAuth(authConfig);

// next-intl's middleware: negotiates/validates the locale, redirects
// unprefixed paths (e.g. `/login`) to a locale-prefixed one (e.g.
// `/uk/login`), and sets the locale cookie so the choice persists across
// navigation.
const intlMiddleware = createIntlMiddleware(routing);

const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const localeMatch = pathname.match(localePattern);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const pathWithoutLocale = localeMatch
    ? pathname.slice(localeMatch[0].length) || "/"
    : pathname;

  const isAccountRoute = pathWithoutLocale.startsWith("/account");
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");

  if (isAccountRoute || isAdminRoute) {
    const isLoggedIn = !!req.auth;

    if (!isLoggedIn) {
      const loginUrl = new URL(`/${locale}/login`, req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminRoute && req.auth?.user?.role !== "ADMIN") {
      return NextResponse.redirect(
        new URL(`/${locale}/forbidden`, req.nextUrl.origin),
      );
    }
  }

  return intlMiddleware(req);
});

export const config = {
  // Run on every page path (so next-intl can resolve/redirect the locale
  // for all of them), but skip API routes, Next internals, and files that
  // look like static assets (have a dot in the last path segment).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
