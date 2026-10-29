// Seed fixtures for local development and manual QA.
//
// Run via `npm run db:seed`. Creates enough data to exercise later specs
// (auth/RBAC, the Information page, discussion, proposals) without having
// to hand-create data every time: one admin, one member, one expert, and
// one published InformationVersion ("GS 0.1").
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
  // label while drafting), so this fixture uses a fixed, well-known id to
  // make the seed idempotent across re-runs.
  const publishedVersion = await prisma.informationVersion.upsert({
    where: {
      id: "seed-information-version-gs-0-1",
    },
    update: {},
    create: {
      id: "seed-information-version-gs-0-1",
      versionLabel: "GS 0.1",
      title: "Win-Win Approach — General Statement",
      body: "This is the seeded, published starting point of the Information page content.",
      status: InformationStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
    },
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
