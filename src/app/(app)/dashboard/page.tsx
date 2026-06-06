import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  // Identity is derived from the signed session cookie only — never from the
  // client (Pitfall 8). Reading the live session also proves AUTH-02:
  // the name persists across a full reload.
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold">Welcome, {session.user.name}</h1>
      <p className="text-sm opacity-70">You are signed in.</p>
    </main>
  );
}
