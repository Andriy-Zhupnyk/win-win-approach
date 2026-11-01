// Data access for the proposal workflow (spec 0009). No auth here: callers
// (the Server Actions and pages) must have already passed `requireRole`.
import { InformationStatus, ProposalStatus, type Prisma } from "@prisma/client";
import { TITLE_MAX_LENGTH } from "@/lib/information-limits";
import { prisma } from "@/lib/prisma";

/** The proposal does not exist or was already accepted/rejected. */
export class ProposalNotPendingError extends Error {
  constructor() {
    super("Proposal not found or already reviewed.");
    this.name = "ProposalNotPendingError";
  }
}

export type ProposalView = {
  id: string;
  proposedBody: string;
  status: ProposalStatus;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  targetVersion: { id: string; versionLabel: string } | null;
  submitterName: string;
};

const proposalInclude = {
  targetVersion: { select: { id: true, versionLabel: true } },
  submittedBy: { select: { displayName: true } },
} satisfies Prisma.ProposalInclude;

function toView(
  proposal: Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>,
): ProposalView {
  return {
    id: proposal.id,
    proposedBody: proposal.proposedBody,
    status: proposal.status,
    reviewNote: proposal.reviewNote,
    createdAt: proposal.createdAt,
    reviewedAt: proposal.reviewedAt,
    targetVersion: proposal.targetVersion,
    submitterName: proposal.submittedBy.displayName,
  };
}

/** Creates a PENDING proposal submitted by `submittedById`. */
export function createProposal(input: {
  submittedById: string;
  proposedBody: string;
  targetVersionId: string | null;
}): Promise<{ id: string }> {
  return prisma.proposal.create({
    data: {
      submittedById: input.submittedById,
      proposedBody: input.proposedBody,
      targetVersionId: input.targetVersionId,
      status: ProposalStatus.PENDING,
    },
    select: { id: true },
  });
}

/** Only the given user's own proposals, newest first. */
export async function listProposalsBySubmitter(
  submittedById: string,
): Promise<ProposalView[]> {
  const proposals = await prisma.proposal.findMany({
    where: { submittedById },
    include: proposalInclude,
    orderBy: { createdAt: "desc" },
  });
  return proposals.map(toView);
}

/** Pending proposals from everyone, oldest first (the review queue). */
export async function listPendingProposals(): Promise<ProposalView[]> {
  const proposals = await prisma.proposal.findMany({
    where: { status: ProposalStatus.PENDING },
    include: proposalInclude,
    orderBy: { createdAt: "asc" },
  });
  return proposals.map(toView);
}

function draftTitle(
  target: { title: string } | null,
  proposedBody: string,
): string {
  if (target) {
    return target.title;
  }
  const firstLine = proposedBody.split("\n")[0]?.trim() ?? "";
  return firstLine.slice(0, TITLE_MAX_LENGTH) || "Proposal";
}

/**
 * Accepts or rejects a PENDING proposal, recording the reviewer and note.
 * Accepting also creates a private DRAFT InformationVersion pre-filled from
 * the proposal; it is never published here (spec 0009 non-goals) - the admin
 * publishes it separately via spec 0007's flow. Throws
 * `ProposalNotPendingError` if the proposal is missing or already reviewed.
 */
export async function reviewProposal(input: {
  id: string;
  reviewerId: string;
  accept: boolean;
  reviewNote: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUnique({
      where: { id: input.id },
      include: { targetVersion: { select: { title: true } } },
    });
    // The conditional update is the authoritative guard against two admins
    // reviewing the same proposal at once.
    const claimed = await tx.proposal.updateMany({
      where: { id: input.id, status: ProposalStatus.PENDING },
      data: {
        status: input.accept
          ? ProposalStatus.ACCEPTED
          : ProposalStatus.REJECTED,
        reviewedById: input.reviewerId,
        reviewNote: input.reviewNote,
        reviewedAt: new Date(),
      },
    });
    if (!proposal || claimed.count === 0) {
      throw new ProposalNotPendingError();
    }
    if (input.accept) {
      await tx.informationVersion.create({
        data: {
          versionLabel: `Proposal ${proposal.id.slice(-6)}`,
          title: draftTitle(proposal.targetVersion, proposal.proposedBody),
          body: proposal.proposedBody,
          status: InformationStatus.DRAFT,
          authorId: input.reviewerId,
        },
      });
    }
  });
}
