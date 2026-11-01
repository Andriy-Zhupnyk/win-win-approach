import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { LocalizedVersion } from "@/lib/information";

// Read-only rendering of one InformationVersion. `isCurrent` is true when
// this is the page's current published content; anything else is clearly
// flagged as archived so it can't be mistaken for the current content.
// Body text is rendered as plain text paragraphs (never as HTML).
export function InformationView({
  version,
  isCurrent,
}: {
  version: LocalizedVersion;
  isCurrent: boolean;
}) {
  const t = useTranslations("information");
  const format = useFormatter();
  const paragraphs = version.body.split(/\n{2,}/).filter(Boolean);

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10">
      {isCurrent ? null : (
        <div
          role="note"
          data-testid="archived-banner"
          className="mb-6 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          {t("archivedNotice", { label: version.versionLabel })}{" "}
          <Link href="/" className="underline">
            {t("viewCurrent")}
          </Link>
        </div>
      )}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {version.versionLabel}
        {version.publishedAt
          ? ` · ${t("publishedOn", {
              date: format.dateTime(version.publishedAt, {
                dateStyle: "long",
                timeZone: "UTC",
              }),
            })}`
          : null}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {version.title}
      </h1>
      <div className="mt-6 space-y-4 text-zinc-700 dark:text-zinc-300">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
      {isCurrent ? (
        <p className="mt-10 text-sm">
          <Link href="/information/versions" className="underline">
            {t("versionHistory")}
          </Link>
        </p>
      ) : null}
    </article>
  );
}
