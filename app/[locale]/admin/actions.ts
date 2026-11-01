"use server";

import { revalidatePath } from "next/cache";
import { createTranslator, hasLocale } from "next-intl";
import {
  createVersion,
  PublishConflictError,
  publishVersion,
  VersionNotFoundError,
} from "@/lib/information-admin";
import {
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  VERSION_LABEL_MAX_LENGTH,
} from "@/lib/information-limits";
import { requireRole, UnauthorizedError } from "@/lib/rbac";
import { routing, type AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type CreateVersionState = {
  error?: string;
  // Which button succeeded; the form clears itself on success.
  success?: "draft" | "published";
  // Echoed back on error so the form keeps what was typed.
  values?: {
    versionLabel: string;
    title: string;
    body: string;
    titleUk: string;
    bodyUk: string;
  };
};

export type PublishVersionState = { error?: string; success?: boolean };

const MESSAGES: Record<AppLocale, typeof en> = { en, uk };

// Locale handling and `createTranslator` mirror
// app/[locale]/register/actions.ts (see the rationale there).
function translatorFor(formData: FormData) {
  const localeRaw = String(formData.get("locale") ?? "");
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "admin.errors",
  });
}

// Refreshes the admin list (the action's own page) and the public pages.
function revalidateInformation() {
  revalidatePath("/", "layout");
}

/** Admin-only guard; returns the admin's id or a translated error. */
async function requireAdmin(
  t: ReturnType<typeof translatorFor>,
): Promise<{ id: string } | { error: string }> {
  // Deferred import, same rationale as requirePageRole in lib/rbac.ts.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  try {
    return requireRole(session, ["ADMIN"]);
  } catch (error) {
    return {
      error:
        error instanceof UnauthorizedError ? t("unauthorized") : t("forbidden"),
    };
  }
}

/**
 * Creates an InformationVersion (spec 0007) either as a private DRAFT or, when
 * the form's `intent` is "publish", directly as the new PUBLISHED version
 * (archiving the previous one atomically). ADMIN only.
 */
export async function createVersionAction(
  _prevState: CreateVersionState,
  formData: FormData,
): Promise<CreateVersionState> {
  const t = translatorFor(formData);
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    versionLabel: text("versionLabel"),
    title: text("title"),
    body: text("body"),
    titleUk: text("titleUk"),
    bodyUk: text("bodyUk"),
  };
  const publish = formData.get("intent") === "publish";

  const admin = await requireAdmin(t);
  if ("error" in admin) {
    return { error: admin.error, values };
  }

  if (!values.versionLabel) {
    return { error: t("versionLabelRequired"), values };
  }
  if (values.versionLabel.length > VERSION_LABEL_MAX_LENGTH) {
    return {
      error: t("versionLabelTooLong", { max: VERSION_LABEL_MAX_LENGTH }),
      values,
    };
  }
  if (!values.title || !values.body) {
    return { error: t("contentRequired"), values };
  }
  if (
    values.title.length > TITLE_MAX_LENGTH ||
    values.titleUk.length > TITLE_MAX_LENGTH
  ) {
    return { error: t("titleTooLong", { max: TITLE_MAX_LENGTH }), values };
  }
  if (
    values.body.length > BODY_MAX_LENGTH ||
    values.bodyUk.length > BODY_MAX_LENGTH
  ) {
    return { error: t("bodyTooLong", { max: BODY_MAX_LENGTH }), values };
  }

  try {
    await createVersion(
      {
        versionLabel: values.versionLabel,
        title: values.title,
        body: values.body,
        titleUk: values.titleUk || null,
        bodyUk: values.bodyUk || null,
        authorId: admin.id,
      },
      publish,
    );
  } catch (error) {
    if (error instanceof PublishConflictError) {
      return { error: t("publishConflict"), values };
    }
    throw error;
  }

  revalidateInformation();
  return { success: publish ? "published" : "draft" };
}

/** Publishes an existing DRAFT, archiving the current one. ADMIN only. */
export async function publishVersionAction(
  _prevState: PublishVersionState,
  formData: FormData,
): Promise<PublishVersionState> {
  const t = translatorFor(formData);

  const admin = await requireAdmin(t);
  if ("error" in admin) {
    return { error: admin.error };
  }

  try {
    await publishVersion(String(formData.get("id") ?? ""));
  } catch (error) {
    if (error instanceof VersionNotFoundError) {
      return { error: t("draftNotFound") };
    }
    if (error instanceof PublishConflictError) {
      return { error: t("publishConflict") };
    }
    throw error;
  }

  revalidateInformation();
  return { success: true };
}
