"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  changeRoleAction,
  type ChangeRoleState,
} from "@/app/[locale]/admin/users/actions";
import { ROLES } from "@/lib/rbac";

export function ChangeRoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: (typeof ROLES)[number];
}) {
  const [state, formAction, pending] = useActionState<
    ChangeRoleState,
    FormData
  >(changeRoleAction, {});
  const t = useTranslations("admin.users");
  const locale = useLocale();

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        aria-label={t("roleSelect")}
        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {t(`roles.${role}`)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-zinc-400 px-3 py-1 text-sm disabled:opacity-60 dark:border-zinc-600"
      >
        {t("save")}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="w-full text-sm text-green-700">
          {t("saved")}
        </p>
      ) : null}
    </form>
  );
}
