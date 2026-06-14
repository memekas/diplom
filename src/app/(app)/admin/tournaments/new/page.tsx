import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { CreateTournamentForm } from "./create-tournament-form";

export default async function NewTournamentPage() {
  // Server-side guard is the source of truth: a non-admin (or anonymous) request
  // never renders this page. requireAdmin throws "Forbidden"/"Unauthorized" off
  // the session cookie; we convert that to a redirect for UX (mirrors admin/page).
  try {
    await requireAdmin();
  } catch (e) {
    // Only the guard's auth contract bounces to /login. Operational failures
    // (DB/session errors) must surface to the error boundary, not masquerade
    // as a logout.
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) {
      redirect("/login");
    }
    throw e;
  }

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <span className="eyebrow">Новый турнир</span>
        <h1>Создать турнир</h1>
        <p className="hint">Создаётся со статусом «Регистрация».</p>
      </header>
      <CreateTournamentForm />
    </main>
  );
}
