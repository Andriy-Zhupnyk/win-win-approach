import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AccountProfileForm } from "@/components/account-profile-form";
import { prisma } from "@/lib/prisma";
import { requirePageRole, ROLES } from "@/lib/rbac";

// Personal account area (spec 0006). Reads only the session user's own row.
export default async function AccountPage() {
  const viewer = await requirePageRole(ROLES);
  const t = await getTranslations("account");
  const format = await getFormatter();

  const user = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { email: true, displayName: true, role: true, createdAt: true },
  });
  if (!user) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">{t("emailLabel")}</dt>
        <dd>{user.email}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">{t("roleLabel")}</dt>
        <dd>{t(`roles.${user.role}`)}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">
          {t("memberSinceLabel")}
        </dt>
        <dd>{format.dateTime(user.createdAt, { dateStyle: "long" })}</dd>
      </dl>
      <AccountProfileForm initialDisplayName={user.displayName} />
    </main>
  );
}
