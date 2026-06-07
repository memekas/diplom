import Link from "next/link";
import { getOptionalSession } from "@/lib/auth-guards";
import { LogoutButton } from "./logout-button";

// Название клуба — placeholder, переименуемо (одна организация-администратор).
const CLUB_NAME = "Падел Клуб";

// Server Component: reads the live session (signed cookie) so the nav reflects
// auth state on every page. Display-only, so it uses the non-throwing
// getOptionalSession() helper — all session reads still funnel through
// auth-guards. Logout is an interactive client leaf.
export async function Nav() {
  const session = await getOptionalSession();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-current/15 px-4 py-3 text-sm sm:px-6">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        {/* Инлайновый SVG-логотип-placeholder (без внешнего ассета) */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle cx="14" cy="14" r="13" fill="currentColor" opacity="0.12" />
          <circle cx="14" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="14" y1="17" x2="14" y2="25" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>{CLUB_NAME}</span>
      </Link>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/tournaments" className="hover:opacity-80">
          Турниры
        </Link>
        <Link href="/tournaments?status=finished" className="hover:opacity-80">
          Прошедшие турниры
        </Link>
        {session?.user ? (
          <>
            {session.user.role === "admin" && (
              <Link href="/admin/tournaments/new" className="hover:opacity-80">
                Создать турнир
              </Link>
            )}
            <Link href="/profile" className="hover:opacity-80">
              Личный кабинет
            </Link>
            <span className="opacity-70">{session.user.name}</span>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="hover:opacity-80">
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-foreground px-3 py-1 text-background hover:opacity-80"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
