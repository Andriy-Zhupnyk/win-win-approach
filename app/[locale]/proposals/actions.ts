"use server";

import { revalidatePath } from "next/cache";
import { createTranslator, hasLocale } from "next-intl";
import { isPublicVersion } from "@/lib/discussion";
import { PROPOSAL_BODY_MAX_LENGTH } from "@/lib/proposal-limits";
import { createProposal } from "@/lib/proposals";
import { requireRole, UnauthorizedError } from "@/lib/rbac";
import { routing, type AppLocale } from "@/i18n/routing";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

export type SubmitProposalState = {
  error?: string;
  // Bumped on every successful submission so the form can reset itself.
  submittedCount?: number;
  // Echoed back on error so the form keeps what was typed.
  values?: { proposedBody: string; targetVersionId: string };
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
    namespace: "proposals.errors",
  });
}

/**
 * Submits a PENDING proposal as the session user (spec 0009). MEMBER and
 * EXPERT only; the submitter is never taken from the form.
 */
export async function submitProposalAction(
  prevState: SubmitProposalState,
  formData: FormData,
): Promise<SubmitProposalState> {
  const t = translatorFor(formData);
  const values = {
    proposedBody: String(formData.get("proposedBody") ?? "").trim(),
    targetVersionId: String(formData.get("targetVersionId") ?? "").trim(),
  };
  const submittedCount = prevState.submittedCount ?? 0;

  // Deferred import, same rationale as requirePageRole in lib/rbac.ts.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  let viewer: { id: string };
  try {
    viewer = requireRole(session, ["MEMBER", "EXPERT"]);
  } catch (error) {
    return {
      error:
        error instanceof UnauthorizedError ? t("unauthorized") : t("forbidden"),
      submittedCount,
      values,
    };
  }

  if (!values.proposedBody) {
    return { error: t("bodyRequired"), submittedCount, values };
  }
  if (values.proposedBody.length > PROPOSAL_BODY_MAX_LENGTH) {
    return {
      error: t("bodyTooLong", { max: PROPOSAL_BODY_MAX_LENGTH }),
      submittedCount,
      values,
    };
  }
  if (
    values.targetVersionId &&
    !(await isPublicVersion(values.targetVersionId))
  ) {
    return { error: t("versionNotFound"), submittedCount, values };
  }

  await createProposal({
    submittedById: viewer.id,
    proposedBody: values.proposedBody,
    targetVersionId: values.targetVersionId || null,
  });

  revalidatePath("/", "layout");
  return { submittedCount: submittedCount + 1 };
}
