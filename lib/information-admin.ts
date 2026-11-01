// Write-side data access for the admin content panel (spec 0007). No auth
// here: callers (the Server Actions in app/[locale]/admin/actions.ts) must
// have already passed `requireRole(session, ["ADMIN"])`.
import {
  InformationStatus,
  Prisma,
  type InformationVersion,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NewVersionInput = {
  versionLabel: string;
  title: string;
  body: string;
  titleUk: string | null;
  bodyUk: string | null;
  authorId: string;
};

export class VersionNotFoundError extends Error {
  constructor() {
    super("Draft version not found.");
    this.name = "VersionNotFoundError";
  }
}

/** Another publish won the race (the DB allows only one PUBLISHED row). */
export class PublishConflictError extends Error {
  constructor() {
    super("Another version was published at the same time.");
    this.name = "PublishConflictError";
  }
}

/** Every version, newest first, including private drafts. */
export function listAllVersions(): Promise<InformationVersion[]> {
  return prisma.informationVersion.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/** Archives the currently published version (if any). Runs inside a tx. */
function archivePublished(tx: Prisma.TransactionClient) {
  return tx.informationVersion.updateMany({
    where: { status: InformationStatus.PUBLISHED },
    data: { status: InformationStatus.ARCHIVED },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Creates a version. `publish: false` saves a private DRAFT. `publish: true`
 * atomically archives the previously published version and creates the new
 * one as PUBLISHED.
 */
export async function createVersion(
  input: NewVersionInput,
  publish: boolean,
): Promise<InformationVersion> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (publish) {
        await archivePublished(tx);
      }
      return tx.informationVersion.create({
        data: {
          ...input,
          status: publish
            ? InformationStatus.PUBLISHED
            : InformationStatus.DRAFT,
          publishedAt: publish ? new Date() : null,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PublishConflictError();
    }
    throw error;
  }
}

/**
 * Publishes an existing DRAFT: archives the previously published version and
 * makes this one the current content, in one transaction. Throws
 * `VersionNotFoundError` if `id` doesn't exist or isn't a draft.
 */
export async function publishVersion(id: string): Promise<InformationVersion> {
  try {
    return await prisma.$transaction(async (tx) => {
      const draft = await tx.informationVersion.findFirst({
        where: { id, status: InformationStatus.DRAFT },
      });
      if (!draft) {
        throw new VersionNotFoundError();
      }
      await archivePublished(tx);
      return tx.informationVersion.update({
        where: { id },
        data: {
          status: InformationStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PublishConflictError();
    }
    throw error;
  }
}
