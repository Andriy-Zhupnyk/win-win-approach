"use server";

import { hash } from "bcryptjs";
import { Role } from "@prisma/client";
import { createTranslator, hasLocale } from "next-intl";
import { prisma } from "@/lib/prisma";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/lib/password-hash";
import { routing, type AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type RegisterState = { error?: string; success?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESSAGES: Record<AppLocale, typeof en> = { en, uk };

/**
 * Registers a new visitor as a `MEMBER` (spec 0003 — `visitor` is never a
 * stored role). The role is always `MEMBER`, whatever the email address:
 * there is no email verification, so nothing here (or anywhere) may grant a
 * role based on an unverified address (spec 0014). Administrators come only
 * from `npm run admin:create`. Deliberately does not sign the user in: the spec's test
 * plan treats register and login as separate steps.
 *
 * Spec 0004: validation/conflict messages are translated. The locale comes
 * from an explicit `locale` form field (set by the client form via
 * `useLocale()`) rather than request-derived next-intl context, because
 * Server Actions don't automatically have a request-scoped locale the way
 * Server Component rendering does — see next-intl's docs on Server
 * Actions/Route Handlers.
 *
 * Translation uses `createTranslator` (from the main "next-intl" package)
 * rather than `getTranslations` (from "next-intl/server"): the latter has
 * a react-server/react-client build split that Next.js's bundler resolves
 * via a custom export condition, which plain Vitest doesn't set — calling
 * it there throws "getTranslations is not supported in Client Components".
 * `createTranslator` has no such split (it's next-intl's documented way to
 * translate outside of a React render, e.g. for emails), so this action
 * behaves identically under `next dev`/`next build` and under
 * tests/register-action.test.ts.
 */
export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const localeRaw = String(formData.get("locale") ?? "");
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "auth.register.errors",
  });

  if (!displayName) {
    return { error: t("displayNameRequired") };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: t("invalidEmail") };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: t("passwordTooShort", { min: MIN_PASSWORD_LENGTH }),
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("emailTaken") };
  }

  const passwordHash = await hash(password, BCRYPT_COST);

  await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      role: Role.MEMBER,
    },
  });

  return { success: true };
}
