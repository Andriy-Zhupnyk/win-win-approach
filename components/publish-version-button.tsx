"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  publishVersionAction,
  type PublishVersionState,
} from "@/app/[locale]/admin/actions";

export function PublishVersionButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<
    PublishVersionState,
    FormData
  >(publishVersionAction, {});
  const t = useTranslations("admin.list");
  const locale = useLocale();

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-zinc-400 px-3 py-1 text-sm disabled:opacity-60 dark:border-zinc-600"
      >
        {t("publish")}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
