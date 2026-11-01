// Read-side data access for the public Information page (spec 0005).
// Only PUBLISHED and ARCHIVED versions are ever exposed here; DRAFT versions
// are private to the admin panel (spec 0007).
import { InformationStatus, type InformationVersion } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PUBLIC_STATUSES: InformationStatus[] = [
  InformationStatus.PUBLISHED,
  InformationStatus.ARCHIVED,
];

export type LocalizedVersion = {
  id: string;
  versionLabel: string;
  title: string;
  body: string;
  status: InformationStatus;
  publishedAt: Date | null;
};

type LocalizableVersion = Pick<
  InformationVersion,
  | "id"
  | "versionLabel"
  | "title"
  | "body"
  | "titleUk"
  | "bodyUk"
  | "status"
  | "publishedAt"
>;

/** Picks the text for `locale`, falling back to the base (English) text. */
export function localizeVersion(
  version: LocalizableVersion,
  locale: string,
): LocalizedVersion {
  const isUk = locale === "uk";
  return {
    id: version.id,
    versionLabel: version.versionLabel,
    title: (isUk && version.titleUk?.trim()) || version.title,
    body: (isUk && version.bodyUk?.trim()) || version.body,
    status: version.status,
    publishedAt: version.publishedAt,
  };
}

/** The current Information page: the most recently published version. */
export async function getCurrentVersion(
  locale: string,
): Promise<LocalizedVersion | null> {
  const version = await prisma.informationVersion.findFirst({
    where: { status: InformationStatus.PUBLISHED },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  return version ? localizeVersion(version, locale) : null;
}

/** A single public (published or archived) version, or null if not public. */
export async function getVersionById(
  id: string,
  locale: string,
): Promise<LocalizedVersion | null> {
  const version = await prisma.informationVersion.findFirst({
    where: { id, status: { in: PUBLIC_STATUSES } },
  });
  return version ? localizeVersion(version, locale) : null;
}

/** All public versions, newest first. */
export async function listVersionHistory(
  locale: string,
): Promise<LocalizedVersion[]> {
  const versions = await prisma.informationVersion.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  return versions.map((version) => localizeVersion(version, locale));
}
