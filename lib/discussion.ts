// Data access for the discussion module (spec 0008).
//
// A thread's "original post" is simply its first Post (by createdAt): the
// `Thread` model has no body column, so creating a thread always creates the
// thread and its opening post together.
import { InformationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PUBLIC_STATUSES: InformationStatus[] = [
  InformationStatus.PUBLISHED,
  InformationStatus.ARCHIVED,
];

export type ThreadSummary = {
  id: string;
  title: string;
  authorName: string;
  createdAt: Date;
  replyCount: number;
  lastActivityAt: Date;
};

export type ThreadDetail = {
  id: string;
  title: string;
  authorName: string;
  createdAt: Date;
  informationVersion: { id: string; versionLabel: string } | null;
  posts: { id: string; body: string; authorName: string; createdAt: Date }[];
};

/**
 * All threads, most recently active first. Last activity is the newest post
 * (falling back to the thread's own creation time); the reply count excludes
 * the opening post. Sorted in memory because "newest child row" is not
 * expressible as a Prisma `orderBy`; fine at MVP scale.
 */
export async function listThreads(): Promise<ThreadSummary[]> {
  const threads = await prisma.thread.findMany({
    include: {
      createdBy: { select: { displayName: true } },
      _count: { select: { posts: true } },
      posts: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return threads
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      authorName: thread.createdBy.displayName,
      createdAt: thread.createdAt,
      replyCount: Math.max(thread._count.posts - 1, 0),
      lastActivityAt: thread.posts[0]?.createdAt ?? thread.createdAt,
    }))
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
}

/** One thread with its posts in chronological order, or null. */
export async function getThread(id: string): Promise<ThreadDetail | null> {
  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      createdBy: { select: { displayName: true } },
      informationVersion: {
        select: { id: true, versionLabel: true, status: true },
      },
      posts: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { author: { select: { displayName: true } } },
      },
    },
  });
  if (!thread) {
    return null;
  }

  // Only link to versions the public can open (never a DRAFT).
  const version = thread.informationVersion;
  return {
    id: thread.id,
    title: thread.title,
    authorName: thread.createdBy.displayName,
    createdAt: thread.createdAt,
    informationVersion:
      version && PUBLIC_STATUSES.includes(version.status)
        ? { id: version.id, versionLabel: version.versionLabel }
        : null,
    posts: thread.posts.map((post) => ({
      id: post.id,
      body: post.body,
      authorName: post.author.displayName,
      createdAt: post.createdAt,
    })),
  };
}

/** Versions a thread may reference: the public ones, newest first. */
export async function listReferenceableVersions() {
  return prisma.informationVersion.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    select: { id: true, versionLabel: true },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
}

export async function isPublicVersion(id: string): Promise<boolean> {
  const version = await prisma.informationVersion.findFirst({
    where: { id, status: { in: PUBLIC_STATUSES } },
    select: { id: true },
  });
  return version !== null;
}

/** Creates a thread together with its opening post, both by `authorId`. */
export async function createThread(input: {
  title: string;
  body: string;
  authorId: string;
  informationVersionId: string | null;
}): Promise<{ id: string }> {
  return prisma.thread.create({
    data: {
      title: input.title,
      createdById: input.authorId,
      informationVersionId: input.informationVersionId,
      posts: { create: { body: input.body, authorId: input.authorId } },
    },
    select: { id: true },
  });
}

/** Adds a reply to an existing thread; returns null if the thread is gone. */
export async function createPost(input: {
  threadId: string;
  body: string;
  authorId: string;
}): Promise<{ id: string } | null> {
  const thread = await prisma.thread.findUnique({
    where: { id: input.threadId },
    select: { id: true },
  });
  if (!thread) {
    return null;
  }
  return prisma.post.create({
    data: {
      threadId: input.threadId,
      body: input.body,
      authorId: input.authorId,
    },
    select: { id: true },
  });
}
