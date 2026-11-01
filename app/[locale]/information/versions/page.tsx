import { InformationStatus } from "@prisma/client";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listVersionHistory } from "@/lib/information";

// Public version history (spec 0005): every published/archived version,
// newest first, each linking to its read-only view.
export const dynamic = "force-dynamic";

export default async function VersionHistoryPage() {
  const locale = await getLocale();
  const t = await getTranslations("information");
  const format = await getFormatter();
  const versions = await listVersionHistory(locale);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {t("versionHistory")}
      </h1>
      {versions.length === 0 ? (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          {t("noVersions")}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
          {versions.map((version) => (
            <li key={version.id} className="py-4">
              <Link
                href={`/information/versions/${version.id}`}
                className="font-medium underline"
              >
                {version.versionLabel}
              </Link>
              <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {version.status === InformationStatus.PUBLISHED
                  ? t("statusCurrent")
                  : t("statusArchived")}
              </span>
              <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                {version.title}
              </p>
              {version.publishedAt ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t("publishedOn", {
                    date: format.dateTime(version.publishedAt, {
                      dateStyle: "long",
                      timeZone: "UTC",
                    }),
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
