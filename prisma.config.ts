// Prisma CLI configuration (migrate, db seed, studio, ...).
//
// Prisma's CLI only auto-loads a plain `.env` file, but this repo's
// convention (see .env.example / README) is `.env.local` for real local
// values. Load it explicitly here so `prisma migrate dev`, `prisma db seed`,
// etc. pick up DATABASE_URL the same way the Next.js app does.
//
// In CI, DATABASE_URL is provided directly as a workflow env var and
// `.env.local` doesn't exist — dotenv.config() silently no-ops in that case
// and never overrides an already-set env var.
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
