import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Shown to visitors in place of a discussion form (spec 0008): reading is
// public, participating needs an account.
export async function LoginPrompt() {
  const t = await getTranslations("discussion.loginPrompt");

  return (
    <p
      data-testid="login-prompt"
      className="rounded border border-zinc-300 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
    >
      {t("message")}{" "}
      <Link href="/login" className="underline">
        {t("login")}
      </Link>{" "}
      {t("or")}{" "}
      <Link href="/register" className="underline">
        {t("register")}
      </Link>
      .
    </p>
  );
}
