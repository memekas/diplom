import Link from "next/link";
import { getOptionalSession } from "@/lib/auth-guards";
import { LogoutButton } from "./logout-button";

// Бренд — одна организация-администратор.
const BRAND = "Padel Pro";

// Server Component: reads the live session (signed cookie) so the nav reflects
// auth state on every page. Display-only, so it uses the non-throwing
// getOptionalSession() helper — all session reads still funnel through
// auth-guards. Logout is an interactive client leaf.
export async function Nav() {
  const session = await getOptionalSession();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--border)] px-4 py-3 text-sm sm:px-6">
      <Link href="/" className="flex items-center gap-2 font-semibold" aria-label={BRAND}>
        {/* Логотип Padel Pro на светлой подложке (читаем на тёмном court-поле). */}
        <span
          style={{
            display: "inline-flex",
            background: "#ffffff",
            borderRadius: "var(--radius)",
            padding: "4px 8px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/padel-pro-logo.png" alt={BRAND} style={{ height: "24px", width: "auto", display: "block" }} />
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/tournaments" className="muted hover:opacity-80">
          Турниры
        </Link>
        {session?.user ? (
          <>
            {session.user.role === "admin" && (
              <Link href="/admin/tournaments/new" className="muted hover:opacity-80">
                Создать турнир
              </Link>
            )}
            <Link href="/profile" className="muted hover:opacity-80">
              Личный кабинет
            </Link>
            <span className="faint">{session.user.name}</span>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="muted hover:opacity-80">
              Войти
            </Link>
            <Link href="/register" className="btn btn-primary">
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
