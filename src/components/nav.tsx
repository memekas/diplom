import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

// Server Component: reads the live session (signed cookie) so the nav reflects
// auth state on every page. Logout is an interactive client leaf.
export async function Nav() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <nav className="flex items-center justify-between border-b border-current/15 px-6 py-3 text-sm">
      <Link href="/" className="font-semibold">
        Padel Tournaments
      </Link>

      <div className="flex items-center gap-4">
        {session?.user ? (
          <>
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
