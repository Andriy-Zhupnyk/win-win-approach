import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern: avoids exhausting DB connections from
// a new PrismaClient being created on every module reload in dev (hot
// reload) or on every server action invocation.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
