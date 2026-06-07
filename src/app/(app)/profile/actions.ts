"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { updateProfile } from "@/lib/services/profile";
import { parseProfileForm } from "@/lib/validation/profile";

export type ProfileActionState =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<
        Record<
          "name" | "courtSide" | "phone" | "skillLevel" | "nickname" | "email" | "birthDate" | "form",
          string
        >
      >;
    }
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

  const parsed = parseProfileForm(formData);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  // email is owned by Better Auth — split it out from the domain fields.
  const { email, ...profile } = parsed.data;

  // 1) Domain fields incl. nickname — direct prisma update. The @@unique
  // nickname conflict surfaces as P2002 → RU message (Pitfall 4, no pre-check).
  try {
    await updateProfile(prisma, user.id, profile);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: false, errors: { nickname: "Этот ник уже занят" } };
    }
    throw e;
  }

  // 2) Email — only if it actually changed. Better Auth lowercases the email
  // internally (signup + changeEmail), and SQLite TEXT compare is BINARY/case
  // -sensitive, so normalize to lowercase BEFORE both the self-compare and the
  // uniqueness pre-check — otherwise a mixed-case duplicate slips past the
  // pre-check and changeEmail silently no-ops on the taken email (anti
  // -enumeration / Pitfall 1; WR-01). Pass the normalized value to changeEmail
  // too so its own lowercased lookup matches what we checked.
  const newEmail = email?.toLowerCase().trim();
  if (newEmail && newEmail !== user.email.toLowerCase()) {
    const clash = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (clash && clash.id !== user.id) {
      return { ok: false, errors: { email: "Этот email уже используется" } };
    }
    try {
      await auth.api.changeEmail({ body: { newEmail }, headers: await headers() });
    } catch {
      return { ok: false, errors: { email: "Не удалось сменить email" } };
    }
  }

  revalidatePath("/profile");
  return { ok: true };
}
