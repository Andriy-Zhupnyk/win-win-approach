// Core logic of `npm run db:seed:demo` (spec 0014): gives the seeded `member`
// and `expert` users a password taken from the environment so a presenter can
// sign in as them. It never creates or modifies an ADMIN account, and the
// password is never stored anywhere but as a bcrypt hash.
import { Role } from "@prisma/client";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "../../lib/password-hash";

export const DEMO_PASSWORD_VAR = "DEMO_ACCOUNTS_PASSWORD";

export class DemoSeedError extends Error {}

export type DemoAccount = {
  email: string;
  displayName: string;
  role: Role;
};

// Same identities as the base seed (prisma/seed.ts). ADMIN is deliberately
// absent: the administrator comes only from `npm run admin:create`.
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: "member@winwinapproach.org",
    displayName: "Member",
    role: Role.MEMBER,
  },
  {
    email: "expert@winwinapproach.org",
    displayName: "Expert",
    role: Role.EXPERT,
  },
];

export function readDemoPassword(
  env: Record<string, string | undefined>,
): string {
  const password = env[DEMO_PASSWORD_VAR];
  if (!password) {
    throw new DemoSeedError(
      `${DEMO_PASSWORD_VAR} is not set. Refusing to seed demo accounts without it.`,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DemoSeedError(
      `${DEMO_PASSWORD_VAR} must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  return password;
}

// Structural subset of PrismaClient used here, so tests can pass a fake.
export type DemoSeedDb = {
  user: {
    findUnique(args: {
      where: { email: string };
      select: { role: true };
    }): Promise<{ role: Role } | null>;
    upsert(args: {
      where: { email: string };
      update: { passwordHash: string };
      create: {
        email: string;
        displayName: string;
        role: Role;
        passwordHash: string;
      };
    }): Promise<unknown>;
  };
};

/**
 * Upserts the demo accounts. An existing user keeps its role (only the
 * password hash is replaced), and a user that is an ADMIN is never touched:
 * the whole run aborts before writing anything for it.
 */
export async function seedDemoAccounts(
  db: DemoSeedDb,
  password: string,
  hash: (password: string, cost: number) => Promise<string>,
): Promise<string[]> {
  for (const account of DEMO_ACCOUNTS) {
    if (account.role === Role.ADMIN) {
      throw new DemoSeedError("Demo accounts must never have the ADMIN role.");
    }
  }
  // Check every account first so a refusal leaves the database untouched.
  for (const account of DEMO_ACCOUNTS) {
    const existing = await db.user.findUnique({
      where: { email: account.email },
      select: { role: true },
    });
    if (existing?.role === Role.ADMIN) {
      throw new DemoSeedError(
        `${account.email} is an ADMIN account; the demo seed never modifies administrators.`,
      );
    }
  }

  const passwordHash = await hash(password, BCRYPT_COST);
  for (const account of DEMO_ACCOUNTS) {
    await db.user.upsert({
      where: { email: account.email },
      update: { passwordHash },
      create: { ...account, passwordHash },
    });
  }
  return DEMO_ACCOUNTS.map((account) => account.email);
}
