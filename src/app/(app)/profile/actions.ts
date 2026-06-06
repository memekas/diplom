"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { updateProfile } from "@/lib/services/profile";
import { profileSchema } from "@/lib/validation/profile";

export type ProfileActionState =
  | { ok: true }
  | { ok: false; errors: Partial<Record<"courtSide" | "phone" | "skillLevel" | "form", string>> }
  | null;

// Server Action = public HTTP endpoint. FIRST line is the security boundary:
// requireUser() derives identity from the signed session cookie (never from the
// form). The userId used for the write is the guard's user.id — a user can only
// edit their OWN profile (Pitfall 8). On success, revalidatePath refreshes the
// /profile read path so the view reflects the change (Pitfall 10).
export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    courtSide: formData.get("courtSide"),
    phone: formData.get("phone") ?? undefined,
    skillLevel: formData.get("skillLevel") || undefined,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }

  await updateProfile(prisma, user.id, parsed.data);
  revalidatePath("/profile");
  return { ok: true };
}
