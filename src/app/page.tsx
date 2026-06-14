import Link from "next/link";
import { prisma } from "@/lib/db";
import { listTournaments } from "@/lib/services/tournament";
import { formatLabels, tournamentKindLabels, skillLevelLabels } from "@/lib/validation/auth";

// Home — public async Server Component (NO auth guard). Entry point to Core Value:
// shows tournaments currently OPEN for registration (status="registration") so a
// visitor sees what they can join and links straight to the detail page. Reads via
// the Plan-01/02 service (server-side `where` filter) → Prisma never hits the client.
// v3.0: Court restyle (token-driven _base classes); data/logic unchanged.
export default async function Home() {
  const tournaments = await listTournaments(prisma, { status: "registration" });

  return (
    <main className="cq mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <span className="eyebrow">Padel · открытые турниры</span>
        <h1 style={{ marginTop: "10px", fontSize: "clamp(2rem, 5vw, 2.8rem)" }}>Открытые турниры</h1>
        <p className="muted" style={{ marginTop: "8px" }}>Турниры, открытые для регистрации — выберите и участвуйте.</p>
      </header>

      {tournaments.length === 0 ? (
        <div className="empty">Сейчас нет открытых турниров.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tournaments/${t.id}`}
                className="card card-pad"
                style={{ display: "flex", flexDirection: "column", gap: "10px" }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-display)", fontSize: "1.15rem" }}>
                    {t.name}
                  </span>
                  <span className="badge badge-reg">Регистрация</span>
                </span>
                <span style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  <span className="pill pill-accent">{formatLabels[t.format as keyof typeof formatLabels] ?? "—"}</span>
                  <span className="pill">{tournamentKindLabels[t.participantMode as keyof typeof tournamentKindLabels] ?? "—"}</span>
                  <span className="pill">{skillLevelLabels[t.level as keyof typeof skillLevelLabels] ?? "—"}</span>
                  <span className="muted" style={{ fontSize: ".85rem" }}>
                    {t.size} {t.participantMode === "pairs" ? "пар" : "участников"}
                  </span>
                  {t.date && <span className="mono muted" style={{ fontSize: ".85rem" }}>{t.date.toLocaleDateString("ru-RU")}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
