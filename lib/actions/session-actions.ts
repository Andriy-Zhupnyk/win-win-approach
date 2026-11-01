"use server";

import { hasLocale } from "next-intl";
import { signOut } from "@/lib/auth";
import { routing } from "@/i18n/routing";

// Spec 0004: the logout form (components/site-nav.tsx) submits a hidden
// `locale` field so the post-logout redirect lands back on the locale the
// user was on, instead of an unprefixed `/` that would need a further
// locale-negotiation redirect.
export async function logoutAction(formData: FormData) {
  const localeRaw = String(formData.get("locale") ?? "");
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;

  await signOut({ redirectTo: `/${locale}` });
}
