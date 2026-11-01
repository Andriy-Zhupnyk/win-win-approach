// @vitest-environment node
//
// Integration tests for the proposal workflow (spec 0009) against a real
// Postgres database (same conventions as tests/admin-actions.test.ts). The
// session is mocked: `auth()` returns whichever user the test selects.
import { randomUUID } from "node:crypto";
import {
  InformationStatus,
  PrismaClient,
  ProposalStatus,
  Role,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { takePublishedSlot } from "./helpers/published-slot";

const revalidate = vi.hoisted(() => vi.fn());
const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; role: string } },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/lib/auth", () => ({
  auth: async () => mockSession.current,
}));

import { reviewProposalAction } from "@/app/[locale]/admin/actions";
import { submitProposalAction } from "@/app/[locale]/proposals/actions";
import { getCurrentVersion } from "@/lib/information";
import { listProposalsBySubmitter } from "@/lib/proposals";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const email = (name: string) => `${name}-${runId}@test.winwinapproach.invalid`;

let adminId: string;
let memberId: string;
let otherMemberId: string;
let expertId: string;
let publishedId: string;
let restorePublished: () => Promise<void>;

function formDataFor(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("locale", "en");
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function signInAs(id: string, role: Role) {
  mockSession.current = { user: { id, role } };
}

function makeProposal(submittedById: string, proposedBody: string) {
  return prisma.proposal.create({ data: { submittedById, proposedBody } });
}

function userIds() {
  return [adminId, memberId, otherMemberId, expertId];
}

async function cleanup() {
  await prisma.proposal.deleteMany({
    where: { submittedById: { in: userIds() } },
  });
  await prisma.informationVersion.deleteMany({
    where: { authorId: { in: userIds() } },
  });
}

beforeAll(async () => {
  restorePublished = await takePublishedSlot(prisma);
  const create = (name: string, role: Role) =>
    prisma.user.create({
      data: { email: email(name), displayName: name, role },
    });
  const [admin, member, other, expert] = await Promise.all([
    create("admin", Role.ADMIN),
    create("member", Role.MEMBER),
    create("other", Role.MEMBER),
    create("expert", Role.EXPERT),
  ]);
  adminId = admin.id;
  memberId = member.id;
  otherMemberId = other.id;
  expertId = expert.id;
});

beforeEach(async () => {
  mockSession.current = null;
  await cleanup();
  const published = await prisma.informationVersion.create({
    data: {
      versionLabel: `T-${runId}-live`,
      title: "Live title",
      body: "Live body",
      status: InformationStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: adminId,
    },
  });
  publishedId = published.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.user.deleteMany({ where: { id: { in: userIds() } } });
  await restorePublished();
  await prisma.$disconnect();
});

describe("submitProposalAction", () => {
  it("lets a member and an expert submit; the proposal starts PENDING", async () => {
    signInAs(memberId, Role.MEMBER);
    const asMember = await submitProposalAction(
      {},
      formDataFor({
        proposedBody: "  Change this  ",
        targetVersionId: publishedId,
      }),
    );
    expect(asMember).toEqual({ submittedCount: 1 });

    signInAs(expertId, Role.EXPERT);
    const asExpert = await submitProposalAction(
      {},
      formDataFor({ proposedBody: "A brand new idea" }),
    );
    expect(asExpert.error).toBeUndefined();

    const [mine] = await listProposalsBySubmitter(memberId);
    expect(mine).toMatchObject({
      proposedBody: "Change this",
      status: ProposalStatus.PENDING,
      reviewNote: null,
      targetVersion: { id: publishedId },
    });
    const [theirs] = await listProposalsBySubmitter(expertId);
    expect(theirs.targetVersion).toBeNull();
  });

  it("rejects visitors and admins without writing anything", async () => {
    const anonymous = await submitProposalAction(
      {},
      formDataFor({ proposedBody: "x" }),
    );
    expect(anonymous.error).toMatch(/logged in/i);

    signInAs(adminId, Role.ADMIN);
    const asAdmin = await submitProposalAction(
      {},
      formDataFor({ proposedBody: "x" }),
    );
    expect(asAdmin.error).toMatch(/permission/i);

    expect(await prisma.proposal.count({ where: { proposedBody: "x" } })).toBe(
      0,
    );
  });

  it("validates input and echoes it back", async () => {
    signInAs(memberId, Role.MEMBER);

    const empty = await submitProposalAction(
      {},
      formDataFor({ proposedBody: "   " }),
    );
    expect(empty.error).toMatch(/required/i);

    const badVersion = await submitProposalAction(
      {},
      formDataFor({ proposedBody: "Text", targetVersionId: "nope" }),
    );
    expect(badVersion.error).toMatch(/does not exist/i);
    expect(badVersion.values?.proposedBody).toBe("Text");

    const draft = await prisma.informationVersion.create({
      data: {
        versionLabel: `T-${runId}-draft`,
        title: "Draft",
        body: "Draft",
        authorId: adminId,
      },
    });
    const privateTarget = await submitProposalAction(
      {},
      formDataFor({ proposedBody: "Text", targetVersionId: draft.id }),
    );
    expect(privateTarget.error).toMatch(/does not exist/i);

    expect(await listProposalsBySubmitter(memberId)).toHaveLength(0);
  });
});

describe("reviewProposalAction", () => {
  it("accepts with a note, creates a draft, and leaves the public page alone", async () => {
    const proposal = await makeProposal(memberId, "Better wording");
    signInAs(adminId, Role.ADMIN);

    const result = await reviewProposalAction(
      {},
      formDataFor({
        id: proposal.id,
        intent: "accept",
        reviewNote: " Good idea ",
      }),
    );

    expect(result).toEqual({ success: true });
    const reloaded = await prisma.proposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(reloaded).toMatchObject({
      status: ProposalStatus.ACCEPTED,
      reviewNote: "Good idea",
      reviewedById: adminId,
    });
    expect(reloaded.reviewedAt).toBeInstanceOf(Date);

    const drafts = await prisma.informationVersion.findMany({
      where: { authorId: adminId, status: InformationStatus.DRAFT },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      body: "Better wording",
      publishedAt: null,
    });
    expect((await getCurrentVersion("en"))?.id).toBe(publishedId);

    // The submitter sees the outcome and the note on their own list.
    const [mine] = await listProposalsBySubmitter(memberId);
    expect(mine).toMatchObject({
      status: ProposalStatus.ACCEPTED,
      reviewNote: "Good idea",
    });
  });

  it("rejects with a note and creates no draft", async () => {
    const proposal = await makeProposal(memberId, "Nope");
    signInAs(adminId, Role.ADMIN);

    const result = await reviewProposalAction(
      {},
      formDataFor({ id: proposal.id, intent: "reject", reviewNote: "Why not" }),
    );

    expect(result).toEqual({ success: true });
    const reloaded = await prisma.proposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(reloaded).toMatchObject({
      status: ProposalStatus.REJECTED,
      reviewNote: "Why not",
    });
    expect(
      await prisma.informationVersion.count({
        where: { authorId: adminId, status: InformationStatus.DRAFT },
      }),
    ).toBe(0);
  });

  it("rejects members, experts and visitors without changing the proposal", async () => {
    const proposal = await makeProposal(memberId, "Mine");

    signInAs(memberId, Role.MEMBER);
    const asMember = await reviewProposalAction(
      {},
      formDataFor({ id: proposal.id, intent: "accept" }),
    );
    expect(asMember.error).toMatch(/permission/i);

    signInAs(expertId, Role.EXPERT);
    const asExpert = await reviewProposalAction(
      {},
      formDataFor({ id: proposal.id, intent: "accept" }),
    );
    expect(asExpert.error).toMatch(/permission/i);

    mockSession.current = null;
    const anonymous = await reviewProposalAction(
      {},
      formDataFor({ id: proposal.id, intent: "reject" }),
    );
    expect(anonymous.error).toMatch(/logged in/i);

    const reloaded = await prisma.proposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(reloaded.status).toBe(ProposalStatus.PENDING);
    expect(
      await prisma.informationVersion.count({
        where: { authorId: adminId, status: InformationStatus.DRAFT },
      }),
    ).toBe(0);
  });

  it("refuses to review twice, unknown ids, bad intents and long notes", async () => {
    const proposal = await makeProposal(memberId, "Once");
    signInAs(adminId, Role.ADMIN);

    await reviewProposalAction(
      {},
      formDataFor({ id: proposal.id, intent: "reject" }),
    );
    const again = await reviewProposalAction(
      {},
      formDataFor({ id: proposal.id, intent: "accept" }),
    );
    expect(again.error).toMatch(/already been reviewed/i);

    const unknown = await reviewProposalAction(
      {},
      formDataFor({ id: "does-not-exist", intent: "accept" }),
    );
    expect(unknown.error).toMatch(/already been reviewed/i);

    const fresh = await makeProposal(memberId, "Fresh");
    const badIntent = await reviewProposalAction(
      {},
      formDataFor({ id: fresh.id, intent: "publish" }),
    );
    expect(badIntent.error).toBeDefined();
    const longNote = await reviewProposalAction(
      {},
      formDataFor({
        id: fresh.id,
        intent: "accept",
        reviewNote: "x".repeat(2001),
      }),
    );
    expect(longNote.error).toMatch(/at most 2000/i);

    const reloaded = await prisma.proposal.findUniqueOrThrow({
      where: { id: fresh.id },
    });
    expect(reloaded.status).toBe(ProposalStatus.PENDING);
    expect(
      await prisma.informationVersion.count({
        where: { authorId: adminId, status: InformationStatus.DRAFT },
      }),
    ).toBe(0);
  });
});

describe("listProposalsBySubmitter", () => {
  it("only returns the given user's own proposals", async () => {
    await makeProposal(memberId, "mine");
    await makeProposal(otherMemberId, "theirs");

    const mine = await listProposalsBySubmitter(memberId);

    expect(mine.map((p) => p.proposedBody)).toEqual(["mine"]);
  });
});
