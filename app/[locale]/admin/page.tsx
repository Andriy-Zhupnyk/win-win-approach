import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/rbac";

// Placeholder: the real admin content management panel arrives with spec
// 0007. This page exists so spec 0003's middleware + server-side RBAC
// guard has a real route to protect (ADMIN only).
export default async function AdminPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("admin");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("comingLater")}</p>
    </main>
  );
}
