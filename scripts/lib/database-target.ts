// Helpers for owner-run scripts that write to a database chosen through the
// environment. They only ever expose the host/port/database name, never the
// credentials embedded in the connection string.

export class DatabaseUrlError extends Error {}

/**
 * Returns the connection string only when `DATABASE_URL` is explicitly set in
 * the process environment. The admin script deliberately does not read
 * `.env.local`, so it cannot silently act on whatever database a dotfile
 * happens to point at.
 */
export function requireExplicitDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new DatabaseUrlError(
      "DATABASE_URL is not set. Export it in your shell first (this script does not read it from .env files).",
    );
  }
  return url;
}

/** `host:port/database` of a Postgres URL, without user or password. */
export function describeDatabaseTarget(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Never echo the raw value: it contains credentials.
    throw new DatabaseUrlError("DATABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new DatabaseUrlError("DATABASE_URL must be a PostgreSQL URL.");
  }
  const port = parsed.port ? `:${parsed.port}` : "";
  const database = parsed.pathname.replace(/^\//, "");
  return `${parsed.hostname}${port}/${database}`;
}
