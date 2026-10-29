"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Spec 0004: visible on every page (rendered from components/site-nav.tsx,
// which is in the root [locale] layout). Links to the same `pathname`
// under each configured locale — `next-intl`'s `Link` takes care of
// prefixing the href, and the active locale is picked up again on the
// next page via its routing cookie, so the choice persists across
// navigation without any extra state of our own.
export function LocaleSwitcher() {
  const activeLocale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("localeSwitcher");

  return (
    <nav aria-label={t("label")} className="flex items-center gap-2">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === activeLocale ? "true" : undefined}
          className={
            locale === activeLocale
              ? "font-semibold text-zinc-900 underline dark:text-zinc-50"
              : "text-zinc-500 hover:underline dark:text-zinc-400"
          }
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
