import { InformationStatus } from "@prisma/client";
import { getFormatter, getTranslations } from "next-intl/server";
import { AdminVersionForm } from "@/components/admin-version-form";
import { PublishVersionButton } from "@/components/publish-version-button";
import { ReviewProposalForm } from "@/components/review-proposal-form";
import { Link } from "@/i18n/navigation";
import { listAllVersions } from "@/lib/information-admin";
import { listPendingProposals } from "@/lib/proposals";
import { requirePageRole } from "@/lib/rbac";

// Admin content management (spec 0007). ADMIN only; the role check lives in
// lib/rbac.ts (middleware.ts is an additional, not the only, guard).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePageRole(["ADMIN"], { fresh: true });
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const [versions, proposals] = await Promise.all([
    listAllVersions(),
    listPendingProposals(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      <Link href="/admin/users" className="text-sm underline">
        {t("usersLink")}
      </Link>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("form.heading")}</h2>
        <AdminVersionForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("proposals.heading")}</h2>
        {proposals.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            {t("proposals.empty")}
          </p>
        ) : (
          <ul
            data-testid="admin-proposal-list"
            className="divide-y divide-zinc-200 dark:divide-zinc-800"
          >
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-col gap-2 py-4"
                data-testid="admin-proposal"
              >
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t("proposals.submittedBy", {
                    author: proposal.submitterName,
                    date: format.dateTime(proposal.createdAt, {
                      dateStyle: "long",
                    }),
                  })}
                </p>
                {proposal.targetVersion ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t("proposals.targets")}{" "}
                    <Link
                      href={`/information/versions/${proposal.targetVersion.id}`}
                      className="underline"
                    >
                      {proposal.targetVersion.versionLabel}
                    </Link>
                  </p>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t("proposals.standalone")}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {proposal.proposedBody}
                </p>
                <ReviewProposalForm id={proposal.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("list.heading")}</h2>
        {versions.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">{t("list.empty")}</p>
        ) : (
          <ul
            data-testid="admin-version-list"
            className="divide-y divide-zinc-200 dark:divide-zinc-800"
          >
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-col gap-1 py-4"
                data-testid={`admin-version-${version.versionLabel}`}
              >
                <div className="flex items-center gap-2">
                  {version.status === InformationStatus.DRAFT ? (
                    <span className="font-medium">{version.versionLabel}</span>
                  ) : (
                    <Link
                      href={`/information/versions/${version.id}`}
                      className="font-medium underline"
                    >
                      {version.versionLabel}
                    </Link>
                  )}
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {t(`status.${version.status}`)}
                  </span>
                </div>
                <p className="text-zinc-800 dark:text-zinc-200">
                  {version.title}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t("list.updatedOn", {
                    date: format.dateTime(version.updatedAt, {
                      dateStyle: "long",
                    }),
                  })}
                </p>
                {version.status === InformationStatus.DRAFT ? (
                  <PublishVersionButton id={version.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
