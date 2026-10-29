import path from "node:path";
import dotenv from "dotenv";
import "@testing-library/jest-dom/vitest";

// Load .env.local for tests that need DATABASE_URL (e.g. the Prisma
// integration tests). In CI, DATABASE_URL is already set via the workflow
// and .env.local doesn't exist, so this is a no-op there.
dotenv.config({ path: path.resolve(import.meta.dirname, "../.env.local") });
