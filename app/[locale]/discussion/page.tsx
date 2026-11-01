import { getFormatter, getTranslations } from "next-intl/server";
import { LoginPrompt } from "@/components/login-prompt";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { listThreads } from "@/lib/discussion";
import { can, ROLES } from "@/lib/rbac";

// Public thread list (spec 0008), most recently active first.
export const dynamic = "force-dynamic";

export default async function DiscussionPage() {
  const t = await getTranslations("discussion");
  const format = await getFormatter();
  const session = await auth();
  const threads = await listThreads();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("heading")}
        </h1>
        {can(session, ROLES) ? (
          <Link
            href="/discussion/new"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t("newThread")}
          </Link>
        ) : null}
      </div>
      {threads.length === 0 ? (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
          {threads.map((thread) => (
            <li key={thread.id} className="py-4">
              <Link
                href={`/discussion/${thread.id}`}
                className="font-medium underline"
              >
                {thread.title}
              </Link>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t("startedBy", {
                  author: thread.authorName,
                  date: format.dateTime(thread.createdAt, {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }),
                })}
                {" · "}
                <span data-testid="reply-count">
                  {t("replies", { count: thread.replyCount })}
                </span>
                {" · "}
                {t("lastActivity", {
                  date: format.dateTime(thread.lastActivityAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {can(session, ROLES) ? null : (
        <div className="mt-8">
          <LoginPrompt />
        </div>
      )}
    </main>
  );
}
