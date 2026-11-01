import { getTranslations } from "next-intl/server";
import { LoginPrompt } from "@/components/login-prompt";
import { NewThreadForm } from "@/components/new-thread-form";
import { auth } from "@/lib/auth";
import { listReferenceableVersions } from "@/lib/discussion";
import { can, ROLES } from "@/lib/rbac";

// Start a thread (spec 0008). Visitors get a log-in prompt instead of the
// form; the Server Action enforces the role check regardless. `?version=<id>`
// pre-selects the Information version being discussed.
export const dynamic = "force-dynamic";

export default async function NewThreadPage({
  searchParams,
}: PageProps<"/[locale]/discussion/new">) {
  const t = await getTranslations("discussion.form");
  const session = await auth();
  const { version } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {t("heading")}
      </h1>
      {can(session, ROLES) ? (
        <NewThreadForm
          versions={await listReferenceableVersions()}
          initialVersionId={typeof version === "string" ? version : ""}
        />
      ) : (
        <LoginPrompt />
      )}
    </main>
  );
}
