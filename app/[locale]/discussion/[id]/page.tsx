import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { LoginPrompt } from "@/components/login-prompt";
import { ReplyForm } from "@/components/reply-form";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getThread } from "@/lib/discussion";
import { can, ROLES } from "@/lib/rbac";

// Public thread detail (spec 0008): opening post, then replies in
// chronological order. Post bodies render as plain text, never HTML.
export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: PageProps<"/[locale]/discussion/[id]">) {
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) {
    notFound();
  }

  const t = await getTranslations("discussion");
  const format = await getFormatter();
  const session = await auth();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <p className="text-sm">
        <Link href="/discussion" className="underline">
          {t("backToList")}
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {thread.title}
      </h1>
      {thread.informationVersion ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("discussingVersion")}{" "}
          <Link
            href={`/information/versions/${thread.informationVersion.id}`}
            className="underline"
          >
            {thread.informationVersion.versionLabel}
          </Link>
        </p>
      ) : null}
      <ol className="mt-6 space-y-4">
        {thread.posts.map((post) => (
          <li
            key={post.id}
            data-testid="post"
            className="rounded border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {post.authorName}
              </span>
              {" · "}
              {format.dateTime(post.createdAt, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              })}
            </p>
            <p className="mt-2 whitespace-pre-line text-zinc-800 dark:text-zinc-200">
              {post.body}
            </p>
          </li>
        ))}
      </ol>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("reply.heading")}
        </h2>
        {can(session, ROLES) ? (
          <ReplyForm threadId={thread.id} />
        ) : (
          <LoginPrompt />
        )}
      </section>
    </main>
  );
}
