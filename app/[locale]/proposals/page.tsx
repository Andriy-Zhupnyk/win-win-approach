import { getFormatter, getTranslations } from "next-intl/server";
import { ProposalForm } from "@/components/proposal-form";
import { Link } from "@/i18n/navigation";
import { listReferenceableVersions } from "@/lib/discussion";
import { listProposalsBySubmitter } from "@/lib/proposals";
import { requirePageRole } from "@/lib/rbac";

// Proposal submission + the submitter's own proposals (spec 0009). MEMBER and
// EXPERT only; the list is always filtered to the session user's id.
// `?version=<id>` pre-selects the Information version being changed.
export const dynamic = "force-dynamic";

export default async function ProposalsPage({
  searchParams,
}: PageProps<"/[locale]/proposals">) {
  const viewer = await requirePageRole(["MEMBER", "EXPERT"]);
  const t = await getTranslations("proposals");
  const format = await getFormatter();
  const { version } = await searchParams;
  const [versions, proposals] = await Promise.all([
    listReferenceableVersions(),
    listProposalsBySubmitter(viewer.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("form.heading")}</h2>
        <ProposalForm
          versions={versions}
          initialVersionId={typeof version === "string" ? version : ""}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("list.heading")}</h2>
        {proposals.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">{t("list.empty")}</p>
        ) : (
          <ul
            data-testid="my-proposal-list"
            className="divide-y divide-zinc-200 dark:divide-zinc-800"
          >
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-col gap-2 py-4"
                data-testid="my-proposal"
              >
                <div className="flex items-center gap-2">
                  <span
                    data-testid="proposal-status"
                    className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {t(`status.${proposal.status}`)}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t("list.submittedOn", {
                      date: format.dateTime(proposal.createdAt, {
                        dateStyle: "long",
                      }),
                    })}
                  </span>
                </div>
                {proposal.targetVersion ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t("list.targets")}{" "}
                    <Link
                      href={`/information/versions/${proposal.targetVersion.id}`}
                      className="underline"
                    >
                      {proposal.targetVersion.versionLabel}
                    </Link>
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {proposal.proposedBody}
                </p>
                {proposal.reviewNote ? (
                  <p
                    data-testid="proposal-review-note"
                    className="rounded border-l-4 border-zinc-300 pl-3 text-sm dark:border-zinc-600"
                  >
                    <span className="font-medium">{t("list.reviewNote")}</span>{" "}
                    {proposal.reviewNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
