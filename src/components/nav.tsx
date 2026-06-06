import Link from "next/link";
import { getOptionalSession } from "@/lib/auth-guards";
import { LogoutButton } from "./logout-button";

// Server Component: reads the live session (signed cookie) so the nav reflects
// auth state on every page. Display-only, so it uses the non-throwing
// getOptionalSession() helper — all session reads still funnel through
// auth-guards. Logout is an interactive client leaf.
export async function Nav() {
  const session = await getOptionalSession();

  return (
    <nav className="flex items-center justify-between border-b border-current/15 px-6 py-3 text-sm">
      <Link href="/" className="font-semibold">
        Padel Tournaments
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/tournaments" className="hover:opacity-80">
          Турниры
        </Link>
        {session?.user ? (
          <>
            {session.user.role === "admin" && (
              <Link href="/admin/tournaments/new" className="hover:opacity-80">
                Создать турнир
              </Link>
            )}
            <span className="opacity-70">{session.user.name}</span>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="hover:opacity-80">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-foreground px-3 py-1 text-background hover:opacity-80"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
