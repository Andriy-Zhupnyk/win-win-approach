import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      <RegisterForm />
      <aside
        aria-labelledby="privacy-notice-heading"
        className="w-full max-w-sm rounded border border-zinc-300 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        <h2
          id="privacy-notice-heading"
          className="mb-1 font-semibold text-zinc-800 dark:text-zinc-200"
        >
          {t("privacy.heading")}
        </h2>
        <p>{t("privacy.body")}</p>
      </aside>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("haveAccount")}{" "}
        <Link href="/login" className="underline">
          {t("loginLink")}
        </Link>
      </p>
    </main>
  );
}
