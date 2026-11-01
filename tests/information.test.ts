// @vitest-environment node
//
// Spec 0005 data-fetching logic, run against the real Postgres database
// (same approach as tests/prisma.integration.test.ts). Fixtures are tagged
// with a random run id and removed afterwards. The "current" fixture uses a
// far-future publishedAt so it is the latest PUBLISHED row regardless of any
// seeded data in the dev database.
import { randomUUID } from "node:crypto";
import { InformationStatus, PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getCurrentVersion,
  getVersionById,
  listVersionHistory,
  localizeVersion,
} from "@/lib/information";

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);

let authorId: string;
const ids = { current: "", archived: "", draft: "", noUk: "" };

async function makeVersion(
  key: keyof typeof ids,
  data: {
    label: string;
    status: InformationStatus;
    publishedAt: Date | null;
    withUk?: boolean;
  },
) {
  const withUk = data.withUk !== false;
  const row = await prisma.informationVersion.create({
    data: {
      versionLabel: `${data.label} ${runId}`,
      title: `Title EN ${data.label}`,
      body: `Body EN ${data.label}`,
      titleUk: withUk ? `Title UK ${data.label}` : null,
      bodyUk: withUk ? `Body UK ${data.label}` : null,
      status: data.status,
      publishedAt: data.publishedAt,
      authorId,
    },
  });
  ids[key] = row.id;
}

beforeAll(async () => {
  const author = await prisma.user.create({
    data: {
      email: `info-${runId}@test.winwinapproach.invalid`,
      displayName: `Info Author ${runId}`,
      role: Role.ADMIN,
    },
  });
  authorId = author.id;

  await makeVersion("archived", {
    label: "ARCH",
    status: InformationStatus.ARCHIVED,
    publishedAt: new Date("2098-01-01T00:00:00Z"),
  });
  await makeVersion("current", {
    label: "CUR",
    status: InformationStatus.PUBLISHED,
    publishedAt: new Date("2099-01-01T00:00:00Z"),
  });
  await makeVersion("draft", {
    label: "DRAFT",
    status: InformationStatus.DRAFT,
    publishedAt: null,
  });
  await makeVersion("noUk", {
    label: "NOUK",
    status: InformationStatus.ARCHIVED,
    publishedAt: new Date("2097-01-01T00:00:00Z"),
    withUk: false,
  });
});

afterAll(async () => {
  await prisma.informationVersion.deleteMany({ where: { authorId } });
  await prisma.user.delete({ where: { id: authorId } });
  await prisma.$disconnect();
});

describe("localizeVersion", () => {
  const base = {
    id: "x",
    versionLabel: "GS",
    title: "EN title",
    body: "EN body",
    titleUk: "UK title",
    bodyUk: "UK body",
    status: InformationStatus.PUBLISHED,
    publishedAt: null,
  };

  it("uses Ukrainian text for uk and base text for en", () => {
    expect(localizeVersion(base, "uk")).toMatchObject({
      title: "UK title",
      body: "UK body",
    });
    expect(localizeVersion(base, "en")).toMatchObject({
      title: "EN title",
      body: "EN body",
    });
  });

  it("falls back to base text when the Ukrainian translation is missing", () => {
    expect(
      localizeVersion({ ...base, titleUk: null, bodyUk: "  " }, "uk"),
    ).toMatchObject({ title: "EN title", body: "EN body" });
  });
});

describe("information data access (integration)", () => {
  it("getCurrentVersion returns the latest published version, localized", async () => {
    const uk = await getCurrentVersion("uk");
    expect(uk?.id).toBe(ids.current);
    expect(uk?.title).toBe("Title UK CUR");
    const en = await getCurrentVersion("en");
    expect(en?.title).toBe("Title EN CUR");
  });

  it("getVersionById returns published and archived versions", async () => {
    expect((await getVersionById(ids.archived, "en"))?.status).toBe(
      InformationStatus.ARCHIVED,
    );
    expect((await getVersionById(ids.current, "en"))?.status).toBe(
      InformationStatus.PUBLISHED,
    );
  });

  it("getVersionById hides drafts and unknown ids", async () => {
    expect(await getVersionById(ids.draft, "en")).toBeNull();
    expect(await getVersionById("does-not-exist", "en")).toBeNull();
  });

  it("listVersionHistory lists public versions newest first, without drafts", async () => {
    const history = await listVersionHistory("en");
    const mine = history
      .map((v) => v.id)
      .filter((id) => Object.values(ids).includes(id));
    expect(mine).toEqual([ids.current, ids.archived, ids.noUk]);
  });
});
