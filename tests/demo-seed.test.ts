// @vitest-environment node
//
// Spec 0014: the opt-in demo-account seed. Refuses without
// DEMO_ACCOUNTS_PASSWORD, only stores a hash, and never creates or modifies
// an ADMIN.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  DEMO_ACCOUNTS,
  DemoSeedError,
  readDemoPassword,
  seedDemoAccounts,
  type DemoSeedDb,
} from "../scripts/lib/demo-seed";
import { BCRYPT_COST } from "../lib/password-hash";

// A throwaway value that only exists in this test; not a real credential.
const PASSWORD = "demo-password-for-tests";

function fakeDb(existing: Record<string, Role> = {}) {
  const findUnique = vi.fn(async (args: { where: { email: string } }) => {
    const role = existing[args.where.email];
    return role ? { role } : null;
  });
  const upsert = vi.fn(async (_args: unknown) => ({}));
  const db = { user: { findUnique, upsert } } as unknown as DemoSeedDb;
  return { db, findUnique, upsert };
}

describe("readDemoPassword", () => {
  it("refuses when the variable is missing, empty or too short", () => {
    expect(() => readDemoPassword({})).toThrow(DemoSeedError);
    expect(() => readDemoPassword({ DEMO_ACCOUNTS_PASSWORD: "" })).toThrow(
      DemoSeedError,
    );
    expect(() => readDemoPassword({ DEMO_ACCOUNTS_PASSWORD: "short" })).toThrow(
      DemoSeedError,
    );
  });

  it("returns the configured password", () => {
    expect(readDemoPassword({ DEMO_ACCOUNTS_PASSWORD: PASSWORD })).toBe(
      PASSWORD,
    );
  });
});

describe("seedDemoAccounts", () => {
  it("never defines an ADMIN demo account", () => {
    expect(DEMO_ACCOUNTS.map((a) => a.role).sort()).toEqual([
      Role.EXPERT,
      Role.MEMBER,
    ]);
  });

  it("upserts member and expert with a hash of the password, never the password", async () => {
    const { db, upsert } = fakeDb();
    const hash = vi.fn(async (_p: string, _c: number) => "HASHED");

    const emails = await seedDemoAccounts(db, PASSWORD, hash);

    expect(hash).toHaveBeenCalledWith(PASSWORD, BCRYPT_COST);
    expect(emails).toEqual(DEMO_ACCOUNTS.map((a) => a.email));
    expect(upsert).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(upsert.mock.calls);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain(Role.ADMIN);
    for (const [args] of upsert.mock.calls as unknown as [
      {
        update: Record<string, unknown>;
        create: { role: Role; passwordHash: string };
      },
    ][]) {
      // An existing user keeps its role: update touches the hash only.
      expect(args.update).toEqual({ passwordHash: "HASHED" });
      expect(args.create.passwordHash).toBe("HASHED");
      expect(args.create.role).not.toBe(Role.ADMIN);
    }
  });

  it("aborts before writing anything if a demo email belongs to an ADMIN", async () => {
    const { db, upsert } = fakeDb({ [DEMO_ACCOUNTS[1].email]: Role.ADMIN });

    await expect(
      seedDemoAccounts(db, PASSWORD, async () => "HASHED"),
    ).rejects.toThrow(DemoSeedError);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("db:seed:demo as run by npm", () => {
  it("exits non-zero without DEMO_ACCOUNTS_PASSWORD, before touching the database", () => {
    const root = path.resolve(import.meta.dirname, "..");
    // An empty value counts as "not set" and (dotenv never overrides an
    // existing variable) cannot be refilled from a developer's .env.local.
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
        "scripts/seed-demo.ts",
      ],
      {
        cwd: root,
        env: { ...process.env, DEMO_ACCOUNTS_PASSWORD: "" },
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DEMO_ACCOUNTS_PASSWORD is not set/);
  });
});
