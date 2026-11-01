import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import {
  mayRefreshSessionCookie,
  stripSessionSetCookies,
} from "@/lib/session-cookie";
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

const authMiddleware = auth((req) => {
  const { pathname } = req.nextUrl;
  const localeMatch = pathname.match(localePattern);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const pathWithoutLocale = localeMatch
    ? pathname.slice(localeMatch[0].length) || "/"
    : pathname;

  const isAccountRoute = pathWithoutLocale.startsWith("/account");
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");
  const isProposalsRoute = pathWithoutLocale.startsWith("/proposals");

  if (isAccountRoute || isAdminRoute || isProposalsRoute) {
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

// Spec 0013: `auth()` copies the refreshed session cookie onto every
// response, including background requests such as link prefetches. One still
// in flight when the user logs out would write the old session back. Only
// browser page navigations may refresh the cookie. The session itself is
// still read and enforced above; only the cookie refresh is dropped.
export default async function middleware(
  ...args: Parameters<typeof authMiddleware>
): Promise<Response | undefined> {
  const [req] = args;
  const response = (await authMiddleware(...args)) as Response | undefined;
  if (response && !mayRefreshSessionCookie(req.headers)) {
    stripSessionSetCookies(response.headers);
  }
  return response;
}

export const config = {
  // Run on every page path (so next-intl can resolve/redirect the locale
  // for all of them), but skip API routes, Next internals, and files that
  // look like static assets (have a dot in the last path segment).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
