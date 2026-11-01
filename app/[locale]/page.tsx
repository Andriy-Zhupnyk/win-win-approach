import { getLocale, getTranslations } from "next-intl/server";
import { InformationView } from "@/components/information-view";
import { getCurrentVersion } from "@/lib/information";

// Public (no auth) Information page: the current PUBLISHED version
// (spec 0005). Reads the database on every request, so never prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getLocale();
  const version = await getCurrentVersion(locale);

  if (!version) {
    const t = await getTranslations("information");
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("emptyHeading")}
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          {t("empty")}
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <InformationView version={version} isCurrent />
    </main>
  );
}
