// @vitest-environment node
//
// Spec 0014: the admin bootstrap script's logic. Everything with a side
// effect (prompts, hashing, the database, logging) is faked, so these tests
// pin the safety properties: explicit DATABASE_URL, no password on the
// command line, confirmation before any write, and the password never
// printed or stored in clear text.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  MIN_ADMIN_PASSWORD_LENGTH,
  parseAdminArgs,
  prismaUpsertAdmin,
  runAdminCreate,
  UsageError,
  type AdminCreateDeps,
} from "../scripts/lib/admin-create";
import {
  DatabaseUrlError,
  describeDatabaseTarget,
  requireExplicitDatabaseUrl,
} from "../scripts/lib/database-target";
import type { Prompter } from "../scripts/lib/prompt";
import { BCRYPT_COST } from "../lib/password-hash";

// Throwaway values that only exist in this test; not real credentials.
const PASSWORD = "correct-horse-battery-staple";
const DB_URL = "postgresql://dbuser:dbsecret@db.example.invalid:5432/demo";

function makeDeps(overrides: Partial<AdminCreateDeps> = {}) {
  const logs: string[] = [];
  const secretAnswers = [PASSWORD, PASSWORD];
  const prompter: Prompter = {
    ask: vi.fn(async () => "typed@example.invalid"),
    askSecret: vi.fn(async () => secretAnswers.shift() ?? ""),
    confirm: vi.fn(async () => true),
  };
  const upsertAdmin = vi.fn(async (_input: unknown) => ({ created: true }));
  const hash = vi.fn(async (_password: string, _cost: number) => "HASHED");
  const deps: AdminCreateDeps = {
    argv: ["Owner@Example.invalid"],
    env: { DATABASE_URL: DB_URL },
    prompter,
    hash,
    upsertAdmin,
    log: (line) => logs.push(line),
    ...overrides,
  };
  return { deps, logs, prompter, upsertAdmin, hash };
}

describe("parseAdminArgs", () => {
  it("accepts a positional email, --email forms and ADMIN_EMAIL, lowercased", () => {
    expect(parseAdminArgs(["A@B.invalid"], {})).toEqual({
      email: "a@b.invalid",
    });
    expect(parseAdminArgs(["--email", "A@B.invalid"], {})).toEqual({
      email: "a@b.invalid",
    });
    expect(parseAdminArgs(["--email=A@B.invalid"], {})).toEqual({
      email: "a@b.invalid",
    });
    expect(parseAdminArgs([], { ADMIN_EMAIL: "E@F.invalid" })).toEqual({
      email: "e@f.invalid",
    });
    expect(parseAdminArgs([], {})).toEqual({ email: undefined });
  });

  it("refuses any password argument", () => {
    for (const argv of [
      ["--password", "x"],
      ["--password=x"],
      ["-p", "x"],
      ["a@b.invalid", "--pass", "x"],
    ]) {
      expect(() => parseAdminArgs(argv, {})).toThrow(UsageError);
    }
  });

  it("rejects invalid emails, unknown options and extra arguments", () => {
    expect(() => parseAdminArgs(["not-an-email"], {})).toThrow(UsageError);
    expect(() => parseAdminArgs(["--nope"], {})).toThrow(UsageError);
    expect(() => parseAdminArgs(["a@b.invalid", "c@d.invalid"], {})).toThrow(
      UsageError,
    );
  });
});

describe("database target", () => {
  it("requires DATABASE_URL to be set explicitly", () => {
    expect(() => requireExplicitDatabaseUrl({})).toThrow(DatabaseUrlError);
    expect(() => requireExplicitDatabaseUrl({ DATABASE_URL: "  " })).toThrow(
      DatabaseUrlError,
    );
    expect(requireExplicitDatabaseUrl({ DATABASE_URL: DB_URL })).toBe(DB_URL);
  });

  it("describes host/port/database without the credentials", () => {
    const described = describeDatabaseTarget(DB_URL);
    expect(described).toBe("db.example.invalid:5432/demo");
    expect(described).not.toContain("dbsecret");
    expect(described).not.toContain("dbuser");
  });

  it("does not echo a malformed or non-Postgres URL", () => {
    for (const bad of ["not a url dbsecret", "mysql://u:dbsecret@h/db"]) {
      try {
        describeDatabaseTarget(bad);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseUrlError);
        expect((error as Error).message).not.toContain("dbsecret");
      }
    }
  });
});

describe("runAdminCreate", () => {
  it("hashes the password at the registration cost and upserts only the hash", async () => {
    const { deps, hash, upsertAdmin } = makeDeps();

    const result = await runAdminCreate(deps);

    expect(result).toEqual({ status: "done", created: true });
    expect(hash).toHaveBeenCalledWith(PASSWORD, BCRYPT_COST);
    expect(upsertAdmin).toHaveBeenCalledWith({
      email: "owner@example.invalid",
      passwordHash: "HASHED",
    });
  });

  it("refuses to run without an explicit DATABASE_URL and prompts for nothing", async () => {
    const { deps, prompter, upsertAdmin } = makeDeps({ env: {} });

    await expect(runAdminCreate(deps)).rejects.toThrow(DatabaseUrlError);

    expect(prompter.ask).not.toHaveBeenCalled();
    expect(prompter.confirm).not.toHaveBeenCalled();
    expect(prompter.askSecret).not.toHaveBeenCalled();
    expect(upsertAdmin).not.toHaveBeenCalled();
  });

  it("shows the target host (not the credentials) and writes nothing if not confirmed", async () => {
    const { deps, logs, prompter, upsertAdmin } = makeDeps();
    vi.mocked(prompter.confirm).mockResolvedValue(false);

    const result = await runAdminCreate(deps);

    expect(result).toEqual({ status: "cancelled" });
    expect(logs.join("\n")).toContain("db.example.invalid:5432/demo");
    expect(logs.join("\n")).not.toContain("dbsecret");
    expect(prompter.askSecret).not.toHaveBeenCalled();
    expect(upsertAdmin).not.toHaveBeenCalled();
  });

  it("prompts for the email when none was supplied", async () => {
    const { deps, prompter, upsertAdmin } = makeDeps({ argv: [] });

    await runAdminCreate(deps);

    expect(prompter.ask).toHaveBeenCalledTimes(1);
    expect(upsertAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ email: "typed@example.invalid" }),
    );
  });

  it("rejects a short password and a mismatched repeat without writing", async () => {
    const short = makeDeps();
    vi.mocked(short.prompter.askSecret).mockResolvedValueOnce(
      "x".repeat(MIN_ADMIN_PASSWORD_LENGTH - 1),
    );
    await expect(runAdminCreate(short.deps)).rejects.toThrow(UsageError);
    expect(short.upsertAdmin).not.toHaveBeenCalled();

    const mismatch = makeDeps();
    vi.mocked(mismatch.prompter.askSecret)
      .mockResolvedValueOnce(PASSWORD)
      .mockResolvedValueOnce(PASSWORD + "-different");
    await expect(runAdminCreate(mismatch.deps)).rejects.toThrow(UsageError);
    expect(mismatch.upsertAdmin).not.toHaveBeenCalled();
  });

  it("never prints or persists the password, even in error messages", async () => {
    const { deps, logs, upsertAdmin } = makeDeps();
    await runAdminCreate(deps);

    expect(logs.join("\n")).not.toContain(PASSWORD);
    expect(JSON.stringify(upsertAdmin.mock.calls)).not.toContain(PASSWORD);

    const mismatch = makeDeps();
    vi.mocked(mismatch.prompter.askSecret)
      .mockResolvedValueOnce(PASSWORD)
      .mockResolvedValueOnce(PASSWORD + "x");
    const error = await runAdminCreate(mismatch.deps).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(PASSWORD);
  });
});

describe("prismaUpsertAdmin", () => {
  it("forces the ADMIN role on create and update, and reports whether it created", async () => {
    const upsert = vi.fn(async (_args: unknown) => ({}));
    const findUnique = vi.fn();
    const run = prismaUpsertAdmin({
      user: { findUnique, upsert },
    } as unknown as Parameters<typeof prismaUpsertAdmin>[0]);

    findUnique.mockResolvedValueOnce(null);
    expect(await run({ email: "a@b.invalid", passwordHash: "H" })).toEqual({
      created: true,
    });
    findUnique.mockResolvedValueOnce({ id: "u1" });
    expect(await run({ email: "a@b.invalid", passwordHash: "H" })).toEqual({
      created: false,
    });

    expect(upsert).toHaveBeenCalledTimes(2);
    for (const [args] of upsert.mock.calls as unknown as [
      { update: { role: Role }; create: { role: Role } },
    ][]) {
      expect(args.update.role).toBe(Role.ADMIN);
      expect(args.create.role).toBe(Role.ADMIN);
    }
  });
});

describe("admin:create as run by npm", () => {
  it("exits non-zero with no DATABASE_URL, before prompting or connecting", () => {
    const root = path.resolve(import.meta.dirname, "..");
    // An empty value counts as "not set" and cannot be refilled from a dotfile.
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
        "scripts/admin-create.ts",
        "owner@example.invalid",
      ],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: "" },
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DATABASE_URL is not set/);
  });
});
