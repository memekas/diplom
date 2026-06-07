import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/services/profile";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  // Security boundary first — identity from the signed session cookie only.
  // The guard throws "Unauthorized" when anonymous; convert to a redirect for UX.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    // Only the guard's auth contract bounces to /login. Operational failures
    // (DB/session errors) must surface to the error boundary, not masquerade
    // as a logout.
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) {
      redirect("/login");
    }
    throw e;
  }

  const profile = await getProfile(prisma, user.id);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Личный кабинет</h1>
        <p className="text-sm opacity-70">{profile.name}</p>
        <p className="text-sm opacity-70">{profile.email}</p>
      </header>

      <ProfileForm
        initial={{
          courtSide: profile.courtSide,
          phone: profile.phone ?? "",
          skillLevel: profile.skillLevel ?? "",
        }}
      />
    </main>
  );
}
