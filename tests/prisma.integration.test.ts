// @vitest-environment node
//
// Integration tests against a real Postgres database (local Docker
// Postgres for dev, a `postgres:16` service container in CI — see
// docker-compose.yml / .github/workflows/ci.yml). We deliberately don't use
// an in-memory/sqlite substitute: this spec is about validating the actual
// schema (enums, FKs, indexes) against the real engine it will run on.
//
// Each test user/email is tagged with a random run id so repeated local
// runs against the persistent dev database never collide with leftover
// rows from a previous run or with `prisma/seed.ts` fixtures, and
// afterAll() cleans up everything this file created.
import { randomUUID } from "node:crypto";
import {
  InformationStatus,
  PrismaClient,
  ProposalStatus,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

const runId = randomUUID().slice(0, 8);
const emailFor = (name: string) =>
  `${name}-${runId}@test.winwinapproach.invalid`;

let adminId: string;
let memberId: string;

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      email: emailFor("admin"),
      displayName: `Test Admin ${runId}`,
      role: Role.ADMIN,
    },
  });
  const member = await prisma.user.create({
    data: {
      email: emailFor("member"),
      displayName: `Test Member ${runId}`,
      role: Role.MEMBER,
    },
  });
  adminId = admin.id;
  memberId = member.id;
});

afterAll(async () => {
  const userIds = [adminId, memberId];
  // Delete in FK-safe order (children before the users they reference).
  await prisma.proposal.deleteMany({
    where: {
      OR: [
        { submittedById: { in: userIds } },
        { reviewedById: { in: userIds } },
      ],
    },
  });
  await prisma.post.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.thread.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.informationVersion.deleteMany({
    where: { authorId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("Prisma core domain model (integration)", () => {
  it("creates and reads a User", async () => {
    const found = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    expect(found.role).toBe(Role.ADMIN);
    expect(found.email).toBe(emailFor("admin"));
  });

  it("creates and reads an InformationVersion with its author relation", async () => {
    const created = await prisma.informationVersion.create({
      data: {
        versionLabel: `TEST ${runId}`,
        title: "Integration test version",
        body: "Round-trip test body.",
        status: InformationStatus.PUBLISHED,
        publishedAt: new Date(),
        authorId: adminId,
      },
    });

    const found = await prisma.informationVersion.findUniqueOrThrow({
      where: { id: created.id },
      include: { author: true },
    });

    expect(found.status).toBe(InformationStatus.PUBLISHED);
    expect(found.author.id).toBe(adminId);
  });

  it("creates and reads a Thread with its Posts and createdBy relation", async () => {
    const thread = await prisma.thread.create({
      data: { title: `Test thread ${runId}`, createdById: memberId },
    });
    const post = await prisma.post.create({
      data: {
        threadId: thread.id,
        authorId: memberId,
        body: "Hello from an integration test.",
      },
    });

    const found = await prisma.thread.findUniqueOrThrow({
      where: { id: thread.id },
      include: { posts: true, createdBy: true },
    });

    expect(found.createdBy.id).toBe(memberId);
    expect(found.posts).toHaveLength(1);
    expect(found.posts[0]?.id).toBe(post.id);
  });

  it("creates and reads a Proposal through submit + review", async () => {
    const proposal = await prisma.proposal.create({
      data: {
        submittedById: memberId,
        proposedBody: "Please update the Information page.",
        status: ProposalStatus.PENDING,
      },
    });

    const reviewed = await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status: ProposalStatus.ACCEPTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: "Looks good.",
      },
    });

    const found = await prisma.proposal.findUniqueOrThrow({
      where: { id: reviewed.id },
      include: { submittedBy: true, reviewedBy: true },
    });

    expect(found.status).toBe(ProposalStatus.ACCEPTED);
    expect(found.submittedBy.id).toBe(memberId);
    expect(found.reviewedBy?.id).toBe(adminId);
    expect(found.targetVersionId).toBeNull();
  });
});
