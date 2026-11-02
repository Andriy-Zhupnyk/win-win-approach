import { getFormatter, getTranslations } from "next-intl/server";
import { ChangeRoleForm } from "@/components/change-role-form";
import { Link } from "@/i18n/navigation";
import { requirePageRole } from "@/lib/rbac";
import { listUsers, USER_LIST_LIMIT } from "@/lib/users-admin";

// Role management (spec 0015). ADMIN only; the role is re-read from the
// database so a demoted administrator is turned away immediately.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePageRole(["ADMIN"], { fresh: true });
  const t = await getTranslations("admin.users");
  const format = await getFormatter();
  const users = await listUsers();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/admin" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      {users.length === USER_LIST_LIMIT ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("capped", { count: USER_LIST_LIMIT })}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="user-table">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-4 font-medium">{t("email")}</th>
              <th className="py-2 pr-4 font-medium">{t("displayName")}</th>
              <th className="py-2 pr-4 font-medium">{t("role")}</th>
              <th className="py-2 pr-4 font-medium">{t("registered")}</th>
              <th className="py-2 font-medium">{t("changeRole")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {users.map((user) => (
              <tr key={user.id} data-testid={`user-row-${user.email}`}>
                <td className="py-3 pr-4 break-all">{user.email}</td>
                <td className="py-3 pr-4">{user.displayName}</td>
                <td className="py-3 pr-4" data-testid="user-role">
                  {t(`roles.${user.role}`)}
                </td>
                <td className="py-3 pr-4">
                  {format.dateTime(user.createdAt, { dateStyle: "medium" })}
                </td>
                <td className="py-3">
                  <ChangeRoleForm userId={user.id} currentRole={user.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
