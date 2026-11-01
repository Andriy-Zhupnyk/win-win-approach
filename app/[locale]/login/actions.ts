"use server";

import { AuthError } from "next-auth";
import { createTranslator, hasLocale } from "next-intl";
import { signIn } from "@/lib/auth";
import { routing, type AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type LoginState = { error?: string };

const MESSAGES: Record<AppLocale, typeof en> = { en, uk };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrlRaw = String(formData.get("callbackUrl") ?? "");
  const localeRaw = String(formData.get("locale") ?? "");
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;
  // Only ever a same-origin, app-relative path (set by middleware.ts or
  // defaulted below) — never follow an absolute/external redirect target.
  const callbackUrl =
    callbackUrlRaw.startsWith("/") && !callbackUrlRaw.startsWith("//")
      ? callbackUrlRaw
      : `/${locale}`;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    // `signIn` throws Next's internal redirect signal on success, which is
    // not an AuthError — let it propagate so the redirect actually happens.
    if (error instanceof AuthError) {
      // Spec 0004: `createTranslator` (unlike `getTranslations` from
      // "next-intl/server") has no react-server/react-client build split,
      // so it works the same inside Next's request lifecycle and under
      // plain Vitest — see the comment in
      // app/[locale]/register/actions.ts for the full rationale.
      const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: "auth.login",
      });
      return { error: t("invalidCredentials") };
    }
    throw error;
  }
}
