// Seed fixtures for local development and manual QA.
//
// Run via `npm run db:seed`. Creates enough data to exercise later specs
// (auth/RBAC, the Information page, discussion, proposals) without having
// to hand-create data every time: one admin, one member, one expert, and
// an archived ("GS 0.1") and a published ("GS 0.2") InformationVersion.
//
// Idempotent: re-running it upserts by email/versionLabel instead of
// duplicating rows.
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient, Role, InformationStatus } from "@prisma/client";

// Loaded directly by `tsx` (not through the Prisma CLI), so load
// `.env.local` ourselves — same convention as prisma.config.ts. In CI,
// DATABASE_URL is already set and this is a no-op.
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@winwinapproach.org" },
    update: {},
    create: {
      email: "admin@winwinapproach.org",
      displayName: "Admin",
      role: Role.ADMIN,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@winwinapproach.org" },
    update: {},
    create: {
      email: "member@winwinapproach.org",
      displayName: "Member",
      role: Role.MEMBER,
    },
  });

  const expert = await prisma.user.upsert({
    where: { email: "expert@winwinapproach.org" },
    update: {},
    create: {
      email: "expert@winwinapproach.org",
      displayName: "Expert",
      role: Role.EXPERT,
    },
  });

  // versionLabel isn't a unique column (by design — admins may reuse a
  // label while drafting), so these fixtures use fixed, well-known ids to
  // make the seed idempotent across re-runs. `update` mirrors `create` so
  // re-seeding also repairs a fixture that drifted (e.g. status changed).
  const archivedData = {
    versionLabel: "GS 0.1",
    title: "Win-Win Approach — General Statement (first draft)",
    body: "This is the first published version of the General Statement.\n\nIt has since been superseded and is kept for reference.",
    titleUk: "Win-Win Approach — Загальна заява (перша редакція)",
    bodyUk:
      "Це перша опублікована версія Загальної заяви.\n\nЇї замінено новішою, а ця зберігається для довідки.",
    status: InformationStatus.ARCHIVED,
    publishedAt: new Date("2026-08-15T12:00:00Z"),
    authorId: admin.id,
  };
  await prisma.informationVersion.upsert({
    where: { id: "seed-information-version-gs-0-1" },
    update: archivedData,
    create: { id: "seed-information-version-gs-0-1", ...archivedData },
  });

  const publishedData = {
    versionLabel: "GS 0.2",
    title: "Win-Win Approach — General Statement",
    body: "This is the current, published version of the General Statement.\n\nIt refines the first draft and is the starting point for discussion.",
    titleUk: "Win-Win Approach — Загальна заява",
    bodyUk:
      "Це поточна опублікована версія Загальної заяви.\n\nВона уточнює першу редакцію і є відправною точкою для обговорення.",
    status: InformationStatus.PUBLISHED,
    publishedAt: new Date("2026-09-15T12:00:00Z"),
    authorId: admin.id,
  };
  const publishedVersion = await prisma.informationVersion.upsert({
    where: { id: "seed-information-version-gs-0-2" },
    update: publishedData,
    create: { id: "seed-information-version-gs-0-2", ...publishedData },
  });

  console.log("Seeded:", {
    admin: admin.email,
    member: member.email,
    expert: expert.email,
    informationVersion: `${publishedVersion.versionLabel} (${publishedVersion.status})`,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
