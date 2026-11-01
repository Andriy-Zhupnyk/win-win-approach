"use server";

import { revalidatePath } from "next/cache";
import { createTranslator, hasLocale } from "next-intl";
import { createPost, createThread, isPublicVersion } from "@/lib/discussion";
import {
  POST_BODY_MAX_LENGTH,
  THREAD_TITLE_MAX_LENGTH,
} from "@/lib/discussion-limits";
import { requireRole, ROLES, UnauthorizedError } from "@/lib/rbac";
import { routing, type AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type CreateThreadState = {
  error?: string;
  // Set on success so the client can navigate to the new thread.
  threadId?: string;
  // Echoed back on error so the form keeps what was typed.
  values?: { title: string; body: string; informationVersionId: string };
};

export type CreatePostState = {
  error?: string;
  // Bumped on every successful post so the form can reset itself.
  postedCount?: number;
  values?: { body: string };
};

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
    namespace: "discussion.errors",
  });
}

/** Any-authenticated-role guard; returns the user's id or a translated error. */
async function requireParticipant(
  t: ReturnType<typeof translatorFor>,
): Promise<{ id: string } | { error: string }> {
  // Deferred import, same rationale as requirePageRole in lib/rbac.ts.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  try {
    return requireRole(session, ROLES);
  } catch (error) {
    return {
      error:
        error instanceof UnauthorizedError ? t("unauthorized") : t("forbidden"),
    };
  }
}

/**
 * Starts a thread (title + opening post), optionally anchored to a public
 * InformationVersion (spec 0008). The author is always the session user —
 * never an id taken from the form.
 */
export async function createThreadAction(
  _prevState: CreateThreadState,
  formData: FormData,
): Promise<CreateThreadState> {
  const t = translatorFor(formData);
  const values = {
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    informationVersionId: String(
      formData.get("informationVersionId") ?? "",
    ).trim(),
  };

  const viewer = await requireParticipant(t);
  if ("error" in viewer) {
    return { error: viewer.error, values };
  }

  if (!values.title) {
    return { error: t("titleRequired"), values };
  }
  if (values.title.length > THREAD_TITLE_MAX_LENGTH) {
    return {
      error: t("titleTooLong", { max: THREAD_TITLE_MAX_LENGTH }),
      values,
    };
  }
  if (!values.body) {
    return { error: t("bodyRequired"), values };
  }
  if (values.body.length > POST_BODY_MAX_LENGTH) {
    return {
      error: t("bodyTooLong", { max: POST_BODY_MAX_LENGTH }),
      values,
    };
  }
  if (
    values.informationVersionId &&
    !(await isPublicVersion(values.informationVersionId))
  ) {
    return { error: t("versionNotFound"), values };
  }

  const thread = await createThread({
    title: values.title,
    body: values.body,
    authorId: viewer.id,
    informationVersionId: values.informationVersionId || null,
  });

  revalidatePath("/", "layout");
  return { threadId: thread.id };
}

/** Replies to a thread as the session user (spec 0008). */
export async function createPostAction(
  prevState: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const t = translatorFor(formData);
  const body = String(formData.get("body") ?? "").trim();
  const threadId = String(formData.get("threadId") ?? "");
  const postedCount = prevState.postedCount ?? 0;

  const viewer = await requireParticipant(t);
  if ("error" in viewer) {
    return { error: viewer.error, postedCount, values: { body } };
  }

  if (!body) {
    return { error: t("bodyRequired"), postedCount, values: { body } };
  }
  if (body.length > POST_BODY_MAX_LENGTH) {
    return {
      error: t("bodyTooLong", { max: POST_BODY_MAX_LENGTH }),
      postedCount,
      values: { body },
    };
  }

  const post = await createPost({ threadId, body, authorId: viewer.id });
  if (!post) {
    return { error: t("threadNotFound"), postedCount, values: { body } };
  }

  revalidatePath("/", "layout");
  return { postedCount: postedCount + 1 };
}
