import { InformationStatus } from "@prisma/client";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { InformationView } from "@/components/information-view";
import { getVersionById } from "@/lib/information";

// Read-only view of one public version (spec 0005). Archived versions are
// flagged as such; a DRAFT or unknown id is a 404.
export const dynamic = "force-dynamic";

export default async function VersionPage({
  params,
}: PageProps<"/[locale]/information/versions/[id]">) {
  const { id } = await params;
  const locale = await getLocale();
  const version = await getVersionById(id, locale);
  if (!version) {
    notFound();
  }

  return (
    <main className="flex-1">
      <InformationView
        version={version}
        isCurrent={version.status === InformationStatus.PUBLISHED}
      />
    </main>
  );
}
