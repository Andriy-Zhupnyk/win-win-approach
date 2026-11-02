"use server";

import { revalidatePath } from "next/cache";
import { createTranslator, hasLocale } from "next-intl";
import {
  ForbiddenError,
  requireFreshRole,
  UnauthorizedError,
} from "@/lib/rbac";
import {
  changeUserRole,
  InvalidRoleError,
  isSerializationFailure,
  LastAdminError,
  OwnRoleChangeError,
  parseRole,
  UserNotFoundError,
} from "@/lib/users-admin";
import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type ChangeRoleState = { error?: string; success?: boolean };

const MESSAGES = { en, uk };

/**
 * Changes another user's role (spec 0015). ADMIN only, decided on the role
 * stored in the database, not the one in the JWT. The acting user always
 * comes from the session; the form supplies only the target and the new role.
 */
export async function changeRoleAction(
  _prevState: ChangeRoleState,
  formData: FormData,
): Promise<ChangeRoleState> {
  // Locale handling mirrors app/[locale]/admin/actions.ts.
  const localeRaw = String(formData.get("locale") ?? "");
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "admin.users.errors",
  });

  // Deferred import, same rationale as requirePageRole in lib/rbac.ts.
  const { auth } = await import("@/lib/auth");
  let actorId: string;
  try {
    actorId = (await requireFreshRole(await auth(), ["ADMIN"])).id;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: t("unauthorized") };
    }
    if (error instanceof ForbiddenError) {
      return { error: t("forbidden") };
    }
    throw error;
  }

  try {
    const targetId = String(formData.get("userId") ?? "");
    const role = parseRole(formData.get("role"));
    const { from, to } = await changeUserRole({ actorId, targetId, role });
    // Minimal audit trail (spec 0015): ids and roles only, no emails.
    console.info(
      `[audit] role-change actor=${actorId} target=${targetId} from=${from} to=${to}`,
    );
  } catch (error) {
    if (error instanceof OwnRoleChangeError) {
      return { error: t("ownRole") };
    }
    if (error instanceof LastAdminError) {
      return { error: t("lastAdmin") };
    }
    if (error instanceof InvalidRoleError) {
      return { error: t("invalidRole") };
    }
    if (error instanceof UserNotFoundError) {
      return { error: t("userNotFound") };
    }
    if (isSerializationFailure(error)) {
      return { error: t("conflict") };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { success: true };
}
