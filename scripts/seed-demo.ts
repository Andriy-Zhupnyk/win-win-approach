// `npm run db:seed:demo` gives the seeded member and expert users a password
// from DEMO_ACCOUNTS_PASSWORD (spec 0014). Explicitly opt-in: the normal
// `db:seed` never sets passwords. Never creates or changes an ADMIN.
import path from "node:path";
import dotenv from "dotenv";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  DemoSeedError,
  readDemoPassword,
  seedDemoAccounts,
} from "./lib/demo-seed";
import {
  DatabaseUrlError,
  describeDatabaseTarget,
  requireExplicitDatabaseUrl,
} from "./lib/database-target";

// Same convention as prisma/seed.ts: a local run reads `.env.local`; a run
// against a hosted database exports the variables in the shell (they win).
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const password = readDemoPassword(process.env);
  const databaseUrl = requireExplicitDatabaseUrl(process.env);
  console.log(`Target database: ${describeDatabaseTarget(databaseUrl)}`);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const emails = await seedDemoAccounts(prisma, password, hash);
    console.log("Demo accounts ready:", emails.join(", "));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof DemoSeedError || error instanceof DatabaseUrlError) {
    console.error(error.message);
  } else {
    // Report the type only: a driver error can embed the connection string.
    console.error(
      `db:seed:demo failed (${error instanceof Error ? error.name : "unknown error"}).`,
    );
  }
  process.exitCode = 1;
});
