// @vitest-environment node
//
// Integration test for the discussion Server Actions and read queries
// against a real Postgres database (same conventions as
// tests/update-profile-action.test.ts). The session is mocked: `auth()`
// returns whichever user the test selects.
import { randomUUID } from "node:crypto";
import { InformationStatus, PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; role: string } },
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => mockSession.current,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createPostAction,
  createThreadAction,
} from "@/app/[locale]/discussion/actions";
import { getThread, listThreads } from "@/lib/discussion";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdVersionIds: string[] = [];

async function createUser(name: string, role: Role = Role.MEMBER) {
  const email = `${name}-${runId}@test.winwinapproach.invalid`;
  createdEmails.push(email);
  return prisma.user.create({
    data: { email, displayName: `User ${name} ${runId}`, role },
  });
}

function formDataFor(fields: Record<string, string>, locale = "en") {
  const formData = new FormData();
  formData.set("locale", locale);
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function signInAs(user: { id: string; role: Role }) {
  mockSession.current = { user: { id: user.id, role: user.role } };
}

beforeEach(() => {
  mockSession.current = null;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.post.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.thread.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.informationVersion.deleteMany({
    where: { id: { in: createdVersionIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("createThreadAction", () => {
  it.each([Role.MEMBER, Role.EXPERT, Role.ADMIN])(
    "lets a %s start a thread, attributing thread and opening post to them",
    async (role) => {
      const user = await createUser(`starter-${role.toLowerCase()}`, role);
      signInAs(user);

      const result = await createThreadAction(
        {},
        formDataFor({
          title: "  Housing costs  ",
          body: "  Let us talk.  ",
          // A forged author must be ignored.
          createdById: "someone-else",
          authorId: "someone-else",
        }),
      );

      expect(result.error).toBeUndefined();
      const thread = await prisma.thread.findUniqueOrThrow({
        where: { id: result.threadId },
        include: { posts: true },
      });
      expect(thread.title).toBe("Housing costs");
      expect(thread.createdById).toBe(user.id);
      expect(thread.informationVersionId).toBeNull();
      expect(thread.posts).toHaveLength(1);
      expect(thread.posts[0]).toMatchObject({
        body: "Let us talk.",
        authorId: user.id,
      });
    },
  );

  it("requires a session and creates nothing when logged out", async () => {
    const before = await prisma.thread.count();

    const result = await createThreadAction(
      {},
      formDataFor({ title: "Anonymous", body: "Hi" }),
    );

    expect(result.error).toMatch(/logged in/i);
    expect(result.threadId).toBeUndefined();
    expect(await prisma.thread.count()).toBe(before);
  });

  it("rejects an empty title or body, and translates the error", async () => {
    const user = await createUser("invalid");
    signInAs(user);

    const noTitle = await createThreadAction(
      {},
      formDataFor({ title: "  ", body: "Body" }),
    );
    const noBody = await createThreadAction(
      {},
      formDataFor({ title: "Title", body: "" }, "uk"),
    );
    const tooLong = await createThreadAction(
      {},
      formDataFor({ title: "x".repeat(201), body: "Body" }),
    );

    expect(noTitle.error).toMatch(/title is required/i);
    expect(noBody.error).toMatch(/Вкажіть/);
    expect(tooLong.error).toMatch(/at most 200/i);
    expect(await prisma.thread.count({ where: { createdById: user.id } })).toBe(
      0,
    );
  });

  it("references a public Information version but rejects drafts and unknown ids", async () => {
    const user = await createUser("versioned");
    signInAs(user);
    const makeVersion = async (status: InformationStatus) => {
      const version = await prisma.informationVersion.create({
        data: {
          versionLabel: `T-${status}-${runId}`,
          title: "t",
          body: "b",
          status,
          authorId: user.id,
        },
      });
      createdVersionIds.push(version.id);
      return version;
    };
    const archived = await makeVersion(InformationStatus.ARCHIVED);
    const draft = await makeVersion(InformationStatus.DRAFT);

    const ok = await createThreadAction(
      {},
      formDataFor({
        title: "About GS",
        body: "Body",
        informationVersionId: archived.id,
      }),
    );
    expect((await getThread(ok.threadId!))?.informationVersion).toEqual({
      id: archived.id,
      versionLabel: archived.versionLabel,
    });

    for (const informationVersionId of [draft.id, "nope"]) {
      const bad = await createThreadAction(
        {},
        formDataFor({ title: "Bad", body: "Body", informationVersionId }),
      );
      expect(bad.error).toMatch(/does not exist/i);
    }
  });
});

describe("createPostAction", () => {
  it("adds a reply attributed to the session user", async () => {
    const owner = await createUser("owner");
    const replier = await createUser("replier", Role.EXPERT);
    signInAs(owner);
    const { threadId } = await createThreadAction(
      {},
      formDataFor({ title: "Topic", body: "Opening" }),
    );

    signInAs(replier);
    const result = await createPostAction(
      {},
      formDataFor({ threadId: threadId!, body: " Reply ", authorId: owner.id }),
    );

    expect(result).toEqual({ postedCount: 1 });
    const thread = await getThread(threadId!);
    expect(thread?.posts.map((post) => post.body)).toEqual([
      "Opening",
      "Reply",
    ]);
    const reply = await prisma.post.findFirstOrThrow({
      where: { threadId, body: "Reply" },
    });
    expect(reply.authorId).toBe(replier.id);
  });

  it("requires a session and adds nothing when logged out", async () => {
    const owner = await createUser("owner-anon");
    signInAs(owner);
    const { threadId } = await createThreadAction(
      {},
      formDataFor({ title: "Topic", body: "Opening" }),
    );

    mockSession.current = null;
    const result = await createPostAction(
      {},
      formDataFor({ threadId: threadId!, body: "Sneaky" }),
    );

    expect(result.error).toMatch(/logged in/i);
    expect(await prisma.post.count({ where: { threadId } })).toBe(1);
  });

  it("rejects an empty body and an unknown thread", async () => {
    const user = await createUser("replier-invalid");
    signInAs(user);

    const empty = await createPostAction(
      {},
      formDataFor({ threadId: "whatever", body: "   " }),
    );
    const missing = await createPostAction(
      {},
      formDataFor({ threadId: "does-not-exist", body: "Hello" }),
    );

    expect(empty.error).toMatch(/required/i);
    expect(missing.error).toMatch(/no longer exists/i);
  });
});

describe("listThreads", () => {
  it("reports reply counts and orders by most recent activity", async () => {
    const user = await createUser("lister");
    signInAs(user);
    const first = await createThreadAction(
      {},
      formDataFor({ title: "First", body: "One" }),
    );
    const second = await createThreadAction(
      {},
      formDataFor({ title: "Second", body: "Two" }),
    );

    // Replying to the older thread makes it the most recently active.
    await createPostAction(
      {},
      formDataFor({ threadId: first.threadId!, body: "Reply A" }),
    );
    await createPostAction(
      {},
      formDataFor({ threadId: first.threadId!, body: "Reply B" }),
    );

    const threads = await listThreads();
    const ids = threads.map((thread) => thread.id);
    expect(ids.indexOf(first.threadId!)).toBeLessThan(
      ids.indexOf(second.threadId!),
    );
    const firstSummary = threads.find((t) => t.id === first.threadId)!;
    const secondSummary = threads.find((t) => t.id === second.threadId)!;
    expect(firstSummary.replyCount).toBe(2);
    expect(secondSummary.replyCount).toBe(0);
    expect(firstSummary.authorName).toBe(`User lister ${runId}`);
    expect(firstSummary.lastActivityAt.getTime()).toBeGreaterThan(
      secondSummary.lastActivityAt.getTime(),
    );
  });
});
