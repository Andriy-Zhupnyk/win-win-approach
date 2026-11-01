// @vitest-environment node
//
// Integration tests for the admin content actions (spec 0007) against a real
// Postgres database (same conventions as tests/update-profile-action.test.ts).
// The session is mocked: `auth()` returns whichever user the test selects.
import { randomUUID } from "node:crypto";
import { InformationStatus, Prisma, PrismaClient, Role } from "@prisma/client";
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

import {
  createVersionAction,
  publishVersionAction,
} from "@/app/[locale]/admin/actions";
import { getCurrentVersion } from "@/lib/information";
import { PublishConflictError, publishVersion } from "@/lib/information-admin";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const label = (name: string) => `T-${runId}-${name}`;

let adminId: string;
let memberId: string;
let restorePublished: () => Promise<void>;

function formDataFor(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("locale", "en");
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function validFields(name: string, extra: Record<string, string> = {}) {
  return {
    versionLabel: label(name),
    title: `Title ${name}`,
    body: `Body ${name}`,
    ...extra,
  };
}

function signInAs(id: string, role: Role) {
  mockSession.current = { user: { id, role } };
}

function findByLabel(name: string) {
  return prisma.informationVersion.findFirst({
    where: { versionLabel: label(name) },
  });
}

async function makeVersion(name: string, status: InformationStatus) {
  return prisma.informationVersion.create({
    data: {
      versionLabel: label(name),
      title: `Title ${name}`,
      body: `Body ${name}`,
      status,
      publishedAt: status === InformationStatus.DRAFT ? null : new Date(),
      authorId: adminId,
    },
  });
}

beforeAll(async () => {
  restorePublished = await takePublishedSlot(prisma);
  const [admin, member] = await Promise.all([
    prisma.user.create({
      data: {
        email: `admin-${runId}@test.winwinapproach.invalid`,
        displayName: "Admin",
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: `member-${runId}@test.winwinapproach.invalid`,
        displayName: "Member",
        role: Role.MEMBER,
      },
    }),
  ]);
  adminId = admin.id;
  memberId = member.id;
});

beforeEach(async () => {
  mockSession.current = null;
  // Start each test with an empty published slot and none of our versions.
  await prisma.informationVersion.deleteMany({
    where: { versionLabel: { startsWith: `T-${runId}` } },
  });
  await prisma.informationVersion.updateMany({
    where: { status: InformationStatus.PUBLISHED },
    data: { status: InformationStatus.ARCHIVED },
  });
});

afterAll(async () => {
  await prisma.informationVersion.deleteMany({
    where: { authorId: { in: [adminId, memberId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId] } } });
  await restorePublished();
  await prisma.$disconnect();
});

describe("createVersionAction", () => {
  it("saves a draft without changing what is publicly visible", async () => {
    const published = await makeVersion("live", InformationStatus.PUBLISHED);
    signInAs(adminId, Role.ADMIN);

    const result = await createVersionAction(
      {},
      formDataFor({ ...validFields("draft"), intent: "draft" }),
    );

    expect(result).toEqual({ success: "draft" });
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
    const draft = await findByLabel("draft");
    expect(draft).toMatchObject({
      status: InformationStatus.DRAFT,
      publishedAt: null,
      authorId: adminId,
      titleUk: null,
      bodyUk: null,
    });
    expect((await getCurrentVersion("en"))?.id).toBe(published.id);
  });

  it("publishing directly archives the previous version and becomes current", async () => {
    const previous = await makeVersion("old", InformationStatus.PUBLISHED);
    signInAs(adminId, Role.ADMIN);

    const result = await createVersionAction(
      {},
      formDataFor({
        ...validFields("new", { titleUk: " Заголовок ", bodyUk: "Текст" }),
        intent: "publish",
      }),
    );

    expect(result).toEqual({ success: "published" });
    const created = await findByLabel("new");
    expect(created).toMatchObject({
      status: InformationStatus.PUBLISHED,
      titleUk: "Заголовок",
      bodyUk: "Текст",
    });
    expect(created?.publishedAt).toBeInstanceOf(Date);
    const archived = await prisma.informationVersion.findUniqueOrThrow({
      where: { id: previous.id },
    });
    expect(archived.status).toBe(InformationStatus.ARCHIVED);
    expect(
      await prisma.informationVersion.count({
        where: { status: InformationStatus.PUBLISHED },
      }),
    ).toBe(1);
    expect((await getCurrentVersion("en"))?.id).toBe(created?.id);
  });

  it("rejects a member and a logged-out visitor without writing anything", async () => {
    signInAs(memberId, Role.MEMBER);
    const asMember = await createVersionAction(
      {},
      formDataFor({ ...validFields("member"), intent: "draft" }),
    );
    expect(asMember.error).toMatch(/permission/i);

    mockSession.current = null;
    const anonymous = await createVersionAction(
      {},
      formDataFor({ ...validFields("anon"), intent: "publish" }),
    );
    expect(anonymous.error).toMatch(/logged in/i);

    expect(await findByLabel("member")).toBeNull();
    expect(await findByLabel("anon")).toBeNull();
  });

  it("validates required fields and echoes the input back", async () => {
    signInAs(adminId, Role.ADMIN);

    const noLabel = await createVersionAction(
      {},
      formDataFor({
        ...validFields("x", { versionLabel: "  " }),
        intent: "draft",
      }),
    );
    expect(noLabel.error).toMatch(/label is required/i);

    const noBody = await createVersionAction(
      {},
      formDataFor({ ...validFields("nobody", { body: "" }), intent: "draft" }),
    );
    expect(noBody.error).toMatch(/title and body/i);
    expect(noBody.values?.title).toBe("Title nobody");
    expect(await findByLabel("nobody")).toBeNull();
  });

  it("translates validation errors to the requested locale", async () => {
    signInAs(adminId, Role.ADMIN);

    const result = await createVersionAction(
      {},
      formDataFor({ locale: "uk", versionLabel: "", title: "", body: "" }),
    );

    expect(result.error).toMatch(/Вкажіть/);
  });
});

describe("publishVersionAction", () => {
  it("archives the previously published version and publishes the draft", async () => {
    const previous = await makeVersion("prev", InformationStatus.PUBLISHED);
    const draft = await makeVersion("draft", InformationStatus.DRAFT);
    signInAs(adminId, Role.ADMIN);

    const result = await publishVersionAction(
      {},
      formDataFor({ id: draft.id }),
    );

    expect(result).toEqual({ success: true });
    const [reloadedPrev, reloadedDraft] = await Promise.all([
      prisma.informationVersion.findUniqueOrThrow({
        where: { id: previous.id },
      }),
      prisma.informationVersion.findUniqueOrThrow({ where: { id: draft.id } }),
    ]);
    expect(reloadedPrev.status).toBe(InformationStatus.ARCHIVED);
    expect(reloadedDraft.status).toBe(InformationStatus.PUBLISHED);
    expect(reloadedDraft.publishedAt).toBeInstanceOf(Date);
    expect((await getCurrentVersion("en"))?.id).toBe(draft.id);
  });

  it("works when nothing is published yet", async () => {
    const draft = await makeVersion("first", InformationStatus.DRAFT);
    signInAs(adminId, Role.ADMIN);

    const result = await publishVersionAction(
      {},
      formDataFor({ id: draft.id }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects non-admins and leaves the draft and published version untouched", async () => {
    const live = await makeVersion("live", InformationStatus.PUBLISHED);
    const draft = await makeVersion("draft", InformationStatus.DRAFT);

    signInAs(memberId, Role.MEMBER);
    const asMember = await publishVersionAction(
      {},
      formDataFor({ id: draft.id }),
    );
    expect(asMember.error).toMatch(/permission/i);

    mockSession.current = null;
    const anonymous = await publishVersionAction(
      {},
      formDataFor({ id: draft.id }),
    );
    expect(anonymous.error).toMatch(/logged in/i);

    const [reloadedLive, reloadedDraft] = await Promise.all([
      prisma.informationVersion.findUniqueOrThrow({ where: { id: live.id } }),
      prisma.informationVersion.findUniqueOrThrow({ where: { id: draft.id } }),
    ]);
    expect(reloadedLive.status).toBe(InformationStatus.PUBLISHED);
    expect(reloadedDraft.status).toBe(InformationStatus.DRAFT);
  });

  it("refuses unknown ids and versions that are not drafts", async () => {
    const live = await makeVersion("live", InformationStatus.PUBLISHED);
    const archived = await makeVersion("arch", InformationStatus.ARCHIVED);
    signInAs(adminId, Role.ADMIN);

    for (const id of ["does-not-exist", live.id, archived.id]) {
      const result = await publishVersionAction({}, formDataFor({ id }));
      expect(result.error).toMatch(/no longer exists/i);
    }
    const reloadedLive = await prisma.informationVersion.findUniqueOrThrow({
      where: { id: live.id },
    });
    expect(reloadedLive.status).toBe(InformationStatus.PUBLISHED);
  });
});

describe("single PUBLISHED version invariant (database level)", () => {
  it("rejects a second PUBLISHED row even when written directly", async () => {
    await makeVersion("one", InformationStatus.PUBLISHED);

    const second = makeVersion("two", InformationStatus.PUBLISHED);

    await expect(second).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(second).rejects.toMatchObject({ code: "P2002" });
  });

  it("leaves exactly one PUBLISHED version after concurrent publishes", async () => {
    const [a, b] = await Promise.all([
      makeVersion("a", InformationStatus.DRAFT),
      makeVersion("b", InformationStatus.DRAFT),
    ]);

    const results = await Promise.allSettled([
      publishVersion(a.id),
      publishVersion(b.id),
    ]);

    // Either both ran one after the other, or the loser hit the unique index.
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const r of results) {
      if (r.status === "rejected") {
        expect(r.reason).toBeInstanceOf(PublishConflictError);
      }
    }

    expect(
      await prisma.informationVersion.count({
        where: { status: InformationStatus.PUBLISHED },
      }),
    ).toBe(1);
  });
});
