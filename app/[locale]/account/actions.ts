"use server";

import { createTranslator, hasLocale } from "next-intl";
import { prisma } from "@/lib/prisma";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";
import { requireRole, ROLES, UnauthorizedError } from "@/lib/rbac";
import { routing, type AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
  // Echoed back so the form keeps showing what was submitted.
  displayName?: string;
};

const MESSAGES: Record<AppLocale, typeof en> = { en, uk };

/**
 * Updates the signed-in user's own display name (spec 0006).
 *
 * The target row is always the session user's id — never an id taken from
 * the form — so a user cannot edit anyone else's profile. Role, email and
 * every other column are deliberately not writable here.
 *
 * Locale handling and the use of `createTranslator` mirror
 * app/[locale]/register/actions.ts (see the rationale there).
 */
export async function updateProfileAction(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const localeRaw = String(formData.get("locale") ?? "");
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "account.edit.errors",
  });

  // Deferred import, same rationale as requirePageRole in lib/rbac.ts.
  const { auth, unstable_update } = await import("@/lib/auth");
  const session = await auth();
  let viewer: { id: string };
  try {
    viewer = requireRole(session, ROLES);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: t("unauthorized"), displayName };
    }
    return { error: t("forbidden"), displayName };
  }

  if (!displayName) {
    return { error: t("displayNameRequired"), displayName };
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      error: t("displayNameTooLong", { max: DISPLAY_NAME_MAX_LENGTH }),
      displayName,
    };
  }

  await prisma.user.update({
    where: { id: viewer.id },
    data: { displayName },
  });

  // The nav reads the name from the JWT, so refresh it too.
  await unstable_update({ user: { name: displayName } });

  return { success: true, displayName };
}
