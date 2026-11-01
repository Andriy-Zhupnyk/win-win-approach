"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  reviewProposalAction,
  type ReviewProposalState,
} from "@/app/[locale]/admin/actions";
import { REVIEW_NOTE_MAX_LENGTH } from "@/lib/proposal-limits";

export function ReviewProposalForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<
    ReviewProposalState,
    FormData
  >(reviewProposalAction, {});
  const t = useTranslations("admin.proposals");
  const locale = useLocale();

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        {t("note")}
        <textarea
          name="reviewNote"
          rows={2}
          maxLength={REVIEW_NOTE_MAX_LENGTH}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="submit"
          name="intent"
          value="accept"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t("accept")}
        </button>
        <button
          type="submit"
          name="intent"
          value="reject"
          disabled={pending}
          className="rounded border border-zinc-400 px-3 py-1 text-sm disabled:opacity-60 dark:border-zinc-600"
        >
          {t("reject")}
        </button>
      </div>
    </form>
  );
}
