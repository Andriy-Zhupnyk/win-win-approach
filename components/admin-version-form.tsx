"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  createVersionAction,
  type CreateVersionState,
} from "@/app/[locale]/admin/actions";
import {
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  VERSION_LABEL_MAX_LENGTH,
} from "@/lib/information-limits";

const inputClass =
  "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black";
const buttonClass = "rounded px-4 py-2 text-sm font-medium disabled:opacity-60";

export function AdminVersionForm() {
  const [state, formAction, pending] = useActionState<
    CreateVersionState,
    FormData
  >(createVersionAction, {});
  const t = useTranslations("admin.form");
  const locale = useLocale();

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm">
        {t("versionLabel")}
        <input
          name="versionLabel"
          type="text"
          maxLength={VERSION_LABEL_MAX_LENGTH}
          placeholder={t("versionLabelPlaceholder")}
          defaultValue={state.values?.versionLabel}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("title")}
        <input
          name="title"
          type="text"
          maxLength={TITLE_MAX_LENGTH}
          defaultValue={state.values?.title}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("body")}
        <textarea
          name="body"
          rows={8}
          maxLength={BODY_MAX_LENGTH}
          defaultValue={state.values?.body}
          className={`${inputClass} font-mono`}
        />
      </label>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("ukHint")}</p>
      <label className="flex flex-col gap-1 text-sm">
        {t("titleUk")}
        <input
          name="titleUk"
          type="text"
          maxLength={TITLE_MAX_LENGTH}
          defaultValue={state.values?.titleUk}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("bodyUk")}
        <textarea
          name="bodyUk"
          rows={8}
          maxLength={BODY_MAX_LENGTH}
          defaultValue={state.values?.bodyUk}
          className={`${inputClass} font-mono`}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-500">
          {state.success === "published" ? t("published") : t("savedDraft")}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className={`${buttonClass} border border-zinc-400 dark:border-zinc-600`}
        >
          {t("saveDraft")}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className={`${buttonClass} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`}
        >
          {t("publish")}
        </button>
      </div>
    </form>
  );
}
