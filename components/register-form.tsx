"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  registerAction,
  type RegisterState,
} from "@/app/[locale]/register/actions";
import { Link } from "@/i18n/navigation";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );
  const t = useTranslations("auth.register");
  const locale = useLocale();

  if (state.success) {
    return (
      <p className="max-w-sm text-sm text-zinc-700 dark:text-zinc-300">
        {t("success")}{" "}
        <Link className="underline" href="/login">
          {t("loginNow")}
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {/* Server Actions don't get the request locale for free — see the
          comment in app/[locale]/register/actions.ts. */}
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm">
        {t("displayNameLabel")}
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("emailLabel")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("passwordLabel")}
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
