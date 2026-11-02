// Core logic of `npm run admin:create` (spec 0014). Every side effect is
// injected so the safety properties are unit-testable without a terminal or
// a database: the password is only ever handed to `hash`, only the hash
// reaches the database, and nothing the script prints can contain it.
import { Role } from "@prisma/client";
import { BCRYPT_COST } from "../../lib/password-hash";
import {
  describeDatabaseTarget,
  requireExplicitDatabaseUrl,
} from "./database-target";
import type { Prompter } from "./prompt";

// Longer than the 8-character registration minimum: this account administers
// a public site.
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export const ADMIN_DEFAULT_DISPLAY_NAME = "Administrator";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UsageError extends Error {}

export type AdminArgs = { email?: string };

/**
 * Accepts `--email <value>`, `--email=<value>`, one positional email, or the
 * `ADMIN_EMAIL` variable (in that order). Any password flag is refused: a
 * password on the command line lands in shell history and process listings.
 */
export function parseAdminArgs(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): AdminArgs {
  let email: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (/^--?pass/i.test(arg)) {
      throw new UsageError(
        "The password is never accepted as an argument. You will be asked for it at a hidden prompt.",
      );
    }
    if (arg === "--email") {
      email = argv[++i];
    } else if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length);
    } else if (arg.startsWith("-")) {
      throw new UsageError(`Unknown option: ${arg}`);
    } else if (email === undefined) {
      email = arg;
    } else {
      throw new UsageError("Unexpected extra argument.");
    }
  }
  email = (email ?? env.ADMIN_EMAIL)?.trim().toLowerCase() || undefined;
  if (email !== undefined && !EMAIL_RE.test(email)) {
    throw new UsageError("The administrator email is not a valid address.");
  }
  return { email };
}

export type UpsertAdmin = (input: {
  email: string;
  passwordHash: string;
}) => Promise<{ created: boolean }>;

export type AdminCreateDeps = {
  argv: readonly string[];
  env: Record<string, string | undefined>;
  prompter: Prompter;
  hash: (password: string, cost: number) => Promise<string>;
  upsertAdmin: UpsertAdmin;
  log: (line: string) => void;
};

export type AdminCreateResult =
  { status: "done"; created: boolean } | { status: "cancelled" };

export async function runAdminCreate(
  deps: AdminCreateDeps,
): Promise<AdminCreateResult> {
  const { prompter, log } = deps;

  // Validate everything that needs no input before prompting for anything.
  const databaseUrl = requireExplicitDatabaseUrl(deps.env);
  const target = describeDatabaseTarget(databaseUrl);
  const { email: emailArg } = parseAdminArgs(deps.argv, deps.env);

  let email = emailArg;
  if (!email) {
    email = (await prompter.ask("Administrator email: ")).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new UsageError("The administrator email is not a valid address.");
    }
  }

  log(`Target database: ${target}`);
  const confirmed = await prompter.confirm(
    "This will create or update an ADMINISTRATOR account in that database. Continue?",
  );
  if (!confirmed) {
    log("Cancelled. Nothing was changed.");
    return { status: "cancelled" };
  }

  const password = await prompter.askSecret("Administrator password: ");
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new UsageError(
      `The password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }
  const repeated = await prompter.askSecret("Repeat the password: ");
  if (repeated !== password) {
    throw new UsageError("The passwords do not match.");
  }

  const passwordHash = await deps.hash(password, BCRYPT_COST);
  const { created } = await deps.upsertAdmin({ email, passwordHash });
  log(
    created
      ? "Administrator account created."
      : "Existing account updated: role set to ADMIN and password replaced.",
  );
  return { status: "done", created };
}

// Structural subset of PrismaClient used here, so tests can pass a fake.
type AdminUserDelegate = {
  user: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    upsert(args: {
      where: { email: string };
      update: { passwordHash: string; role: Role };
      create: {
        email: string;
        displayName: string;
        passwordHash: string;
        role: Role;
      };
    }): Promise<unknown>;
  };
};

/** The only write this script makes: upsert by email, role forced to ADMIN. */
export function prismaUpsertAdmin(db: AdminUserDelegate): UpsertAdmin {
  return async ({ email, passwordHash }) => {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    await db.user.upsert({
      where: { email },
      update: { passwordHash, role: Role.ADMIN },
      create: {
        email,
        displayName: ADMIN_DEFAULT_DISPLAY_NAME,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    return { created: existing === null };
  };
}
