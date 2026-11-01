"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  createPostAction,
  type CreatePostState,
} from "@/app/[locale]/discussion/actions";
import { POST_BODY_MAX_LENGTH } from "@/lib/discussion-limits";

export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, formAction, pending] = useActionState<
    CreatePostState,
    FormData
  >(createPostAction, {});
  const t = useTranslations("discussion.reply");
  const locale = useLocale();

  return (
    // Re-keyed on each successful post so the textarea resets to empty.
    <form
      key={state.postedCount ?? 0}
      action={formAction}
      className="flex w-full flex-col gap-3"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="threadId" value={threadId} />
      <label className="flex flex-col gap-1 text-sm">
        {t("body")}
        <textarea
          name="body"
          rows={5}
          maxLength={POST_BODY_MAX_LENGTH}
          defaultValue={state.values?.body}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
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
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
