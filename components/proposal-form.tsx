"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  submitProposalAction,
  type SubmitProposalState,
} from "@/app/[locale]/proposals/actions";
import { PROPOSAL_BODY_MAX_LENGTH } from "@/lib/proposal-limits";

const inputClass =
  "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black";

export function ProposalForm({
  versions,
  initialVersionId,
}: {
  versions: { id: string; versionLabel: string }[];
  initialVersionId: string;
}) {
  const [state, formAction, pending] = useActionState<
    SubmitProposalState,
    FormData
  >(submitProposalAction, {});
  const t = useTranslations("proposals.form");
  const locale = useLocale();

  return (
    // Re-keyed on every successful submission so the fields reset.
    <form
      key={state.submittedCount ?? 0}
      action={formAction}
      className="flex w-full flex-col gap-3"
    >
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm">
        {t("version")}
        <select
          name="targetVersionId"
          defaultValue={state.values?.targetVersionId ?? initialVersionId}
          className={inputClass}
        >
          <option value="">{t("noVersion")}</option>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.versionLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("body")}
        <textarea
          name="proposedBody"
          rows={8}
          maxLength={PROPOSAL_BODY_MAX_LENGTH}
          defaultValue={state.values?.proposedBody}
          className={`${inputClass} font-mono`}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {!state.error && state.submittedCount ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-500">
          {t("submitted")}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
