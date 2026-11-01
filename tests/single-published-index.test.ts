// @vitest-environment node
//
// Guard for spec 0011: the partial unique index that enforces "at most one
// PUBLISHED InformationVersion" (spec 0007) exists only in migration SQL,
// because Prisma's schema language cannot express partial indexes. If a later
// `prisma migrate dev` ever drops it, this test fails after `migrate deploy`
// (CI applies migrations before running tests).
//
// The read-only catalog query below is the one place raw SQL is used here;
// Prisma has no model for `pg_indexes`.
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const INDEX_NAME = "InformationVersion_single_published_key";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("single-PUBLISHED InformationVersion index", () => {
  it("exists as a partial unique index on PUBLISHED rows", async () => {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'InformationVersion'
        AND indexname = ${INDEX_NAME}
    `;

    expect(
      rows,
      `Partial unique index "${INDEX_NAME}" is missing. A migration probably dropped it; ` +
        `edit the new (unapplied) migration to remove the DROP INDEX; never edit an applied one.`,
    ).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/CREATE UNIQUE INDEX/);
    expect(rows[0].indexdef).toMatch(/WHERE.*status.*PUBLISHED/);
  });
});
