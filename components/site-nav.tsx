import Link from "next/link";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logoutAction } from "@/lib/actions/session-actions";

// Role-appropriate navigation (spec 0003): visitors see login/register,
// logged-in users see their account + logout, and only admins see the
// "Admin" link. This is a convenience/UX concern only — it is not a
// security boundary; `/admin` and `/account` are enforced by
// middleware.ts + lib/rbac.ts regardless of what this nav renders.
export async function SiteNav() {
  const session = await auth();
  const user = session?.user;

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 text-sm dark:border-zinc-800">
      <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
        Win-Win Approach
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-zinc-500 dark:text-zinc-400">
              {user.name ?? user.email}
            </span>
            <Link href="/account">Account</Link>
            {can(session, ["ADMIN"]) ? <Link href="/admin">Admin</Link> : null}
            <form action={logoutAction}>
              <button type="submit" className="underline">
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
