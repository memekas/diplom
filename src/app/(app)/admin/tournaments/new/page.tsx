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
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Создать турнир</h1>
      <CreateTournamentForm />
    </main>
  );
}
