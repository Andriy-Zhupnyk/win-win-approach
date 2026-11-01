// The database allows at most one PUBLISHED InformationVersion (spec 0007),
// so integration tests that need to publish something must first free the
// slot and put the original back afterwards, or they would break against a
// seeded dev database. Test files run one at a time (vitest.config.mts,
// `fileParallelism: false`) so they never contend for the slot.
import { InformationStatus, type PrismaClient } from "@prisma/client";

/**
 * Archives whatever is currently PUBLISHED and returns a `restore()` to call
 * in `afterAll`, after the test's own versions have been deleted.
 */
export async function takePublishedSlot(prisma: PrismaClient) {
  const originals = await prisma.informationVersion.findMany({
    where: { status: InformationStatus.PUBLISHED },
    select: { id: true },
  });
  const ids = originals.map((row) => row.id);
  await prisma.informationVersion.updateMany({
    where: { id: { in: ids } },
    data: { status: InformationStatus.ARCHIVED },
  });

  return async function restore() {
    await prisma.informationVersion.updateMany({
      where: { status: InformationStatus.PUBLISHED },
      data: { status: InformationStatus.ARCHIVED },
    });
    await prisma.informationVersion.updateMany({
      where: { id: { in: ids } },
      data: { status: InformationStatus.PUBLISHED },
    });
  };
}
