"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  updateProfileAction,
  type UpdateProfileState,
} from "@/app/[locale]/account/actions";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";

export function AccountProfileForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const [state, formAction, pending] = useActionState<
    UpdateProfileState,
    FormData
  >(updateProfileAction, {});
  const t = useTranslations("account");
  const locale = useLocale();

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm">
        {t("displayNameLabel")}
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          defaultValue={state.displayName ?? initialDisplayName}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-500">
          {t("edit.saved")}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? t("edit.saving") : t("edit.save")}
      </button>
    </form>
  );
}
