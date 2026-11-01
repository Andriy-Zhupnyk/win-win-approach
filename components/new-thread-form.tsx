"use client";

import { useActionState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  createThreadAction,
  type CreateThreadState,
} from "@/app/[locale]/discussion/actions";
import { useRouter } from "@/i18n/navigation";
import {
  POST_BODY_MAX_LENGTH,
  THREAD_TITLE_MAX_LENGTH,
} from "@/lib/discussion-limits";

const inputClass =
  "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black";

export function NewThreadForm({
  versions,
  initialVersionId,
}: {
  versions: { id: string; versionLabel: string }[];
  initialVersionId: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateThreadState,
    FormData
  >(createThreadAction, {});
  const t = useTranslations("discussion.form");
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (state.threadId) {
      router.push(`/discussion/${state.threadId}`);
    }
  }, [state.threadId, router]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm">
        {t("title")}
        <input
          name="title"
          type="text"
          maxLength={THREAD_TITLE_MAX_LENGTH}
          defaultValue={state.values?.title}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("body")}
        <textarea
          name="body"
          rows={8}
          maxLength={POST_BODY_MAX_LENGTH}
          defaultValue={state.values?.body}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("version")}
        <select
          name="informationVersionId"
          defaultValue={state.values?.informationVersionId ?? initialVersionId}
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
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
