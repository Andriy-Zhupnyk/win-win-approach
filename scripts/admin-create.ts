// `npm run admin:create [-- <email>]` creates or updates the administrator
// account (spec 0014). Run by the site owner, by hand, in an interactive
// terminal. The password is typed at a hidden prompt; it is never accepted as
// an argument, read from a file or printed. See README.md ("Deploying the demo").
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  prismaUpsertAdmin,
  runAdminCreate,
  UsageError,
} from "./lib/admin-create";
import {
  DatabaseUrlError,
  requireExplicitDatabaseUrl,
} from "./lib/database-target";
import {
  NotInteractiveError,
  PromptAbortedError,
  terminalPrompter,
} from "./lib/prompt";

async function main() {
  // Pass the URL explicitly so Prisma cannot fall back to a `.env` file.
  const prisma = new PrismaClient({
    datasourceUrl: requireExplicitDatabaseUrl(process.env),
  });
  try {
    await runAdminCreate({
      argv: process.argv.slice(2),
      env: process.env,
      prompter: terminalPrompter,
      hash,
      upsertAdmin: prismaUpsertAdmin(prisma),
      log: (line) => console.log(line),
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (
    error instanceof UsageError ||
    error instanceof DatabaseUrlError ||
    error instanceof PromptAbortedError ||
    error instanceof NotInteractiveError
  ) {
    console.error(error.message);
  } else {
    // Unexpected failure: report the type only, never the full error object
    // (a driver error can embed the connection string).
    console.error(
      `admin:create failed (${error instanceof Error ? error.name : "unknown error"}).`,
    );
  }
  process.exitCode = 1;
});
