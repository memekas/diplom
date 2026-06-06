import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";

export default async function AdminPage() {
  // Server-side guard is the source of truth: a non-admin (or anonymous) request
  // never renders this page. requireAdmin throws "Forbidden"/"Unauthorized" off
  // the session cookie; we convert that to a redirect for UX.
  try {
    await requireAdmin();
  } catch {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="text-sm opacity-70">
        Admin area. Tournament management lands here in later phases.
      </p>
    </main>
  );
}
