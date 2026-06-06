import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";

export default async function DashboardPage() {
  // Identity is derived from the signed session cookie only — never from the
  // client (Pitfall 8). Use the shared requireUser() guard (same boundary as
  // profile/admin) so the auth check stays single-sourced. Reading the live
  // session also proves AUTH-02: the name persists across a full reload.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) {
      redirect("/login");
    }
    throw e; // let real (operational) errors hit the error boundary
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <p className="text-sm opacity-70">You are signed in.</p>
    </main>
  );
}
