import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage(props: PageProps<"/[locale]/login">) {
  const searchParams = await props.searchParams;
  const callbackUrlParam = searchParams.callbackUrl;
  const callbackUrl =
    typeof callbackUrlParam === "string" ? callbackUrlParam : undefined;
  const t = await getTranslations("auth.login");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      <LoginForm callbackUrl={callbackUrl} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("noAccount")}{" "}
        <Link href="/register" className="underline">
          {t("registerLink")}
        </Link>
      </p>
    </main>
  );
}
