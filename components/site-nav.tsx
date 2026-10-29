import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logoutAction } from "@/lib/actions/session-actions";
import { LocaleSwitcher } from "@/components/locale-switcher";

// Role-appropriate navigation (spec 0003): visitors see login/register,
// logged-in users see their account + logout, and only admins see the
// "Admin" link. This is a convenience/UX concern only — it is not a
// security boundary; `/admin` and `/account` are enforced by
// middleware.ts + lib/rbac.ts regardless of what this nav renders.
//
// Spec 0004: every label is translated, and the locale switcher is
// rendered here so it's visible on every page. Uses the awaitable
// `getTranslations`/`getLocale` (not the `useTranslations`/`useLocale`
// hooks) because this is an `async function` component — `eslint-
// plugin-react-hooks` flags hook calls there even though next-intl
// supports it, so the async APIs sidestep that without disabling the rule.
export async function SiteNav() {
  const session = await auth();
  const user = session?.user;
  const common = await getTranslations("common");
  const t = await getTranslations("nav");
  const locale = await getLocale();

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 text-sm dark:border-zinc-800">
      <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
        {common("siteName")}
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-zinc-500 dark:text-zinc-400">
              {user.name ?? user.email}
            </span>
            <Link href="/account">{t("account")}</Link>
            {can(session, ["ADMIN"]) ? (
              <Link href="/admin">{t("admin")}</Link>
            ) : null}
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="underline">
                {t("logout")}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">{t("login")}</Link>
            <Link href="/register">{t("register")}</Link>
          </>
        )}
        <LocaleSwitcher />
      </div>
    </nav>
  );
}
