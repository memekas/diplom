"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="rounded-md border border-current/40 px-3 py-1 hover:opacity-80"
    >
      Log out
    </button>
  );
}
